import sys
import traceback
from flask import Flask, request, jsonify
from flask_cors import CORS
from ortools.sat.python import cp_model

app = Flask(__name__)
CORS(app) # Allow cross-origin requests

@app.route('/solve-timetable', methods=['POST'])
def solve_timetable():
    """
    This microservice endpoint solves the timetabling problem using OR-Tools.
    It receives the problem data from the Node.js API gateway.
    """
    try:
        # --- 1. PARSE INPUT DATA ---
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid JSON input"}), 400

        classrooms_data = data.get('classrooms', [])
        faculties_data = data.get('faculties', [])
        batches_data = data.get('batches', [])
        settings = data.get('settings', {})

        num_days = settings.get('working_days', 5)
        num_hours_per_day = settings.get('hours_per_day', 8)
        start_hour = settings.get('start_hour', 9)
        
        # Get penalty weights for soft constraints from settings
        penalties = settings.get('penalties', {})
        gap_penalty = penalties.get('batch_gap', 1)
        subject_spread_penalty = penalties.get('subject_spread', 5)
        # New penalty for having more than 2 contiguous classes
        max_contiguous_penalty = penalties.get('max_contiguous', 10)

        all_classrooms = [c['id'] for c in classrooms_data]
        all_faculties = [f['id'] for f in faculties_data]
        all_batches = {b['name']: b for b in batches_data}
        all_subjects = list(set(sub['name'] for b in batches_data for sub in b['subjects']))

        # Create a list of all individual class sessions to be scheduled
        classes_to_schedule = []
        for batch in batches_data:
            for subject in batch['subjects']:
                for i in range(subject['classes_per_week']):
                    classes_to_schedule.append({
                        "id": f"{batch['name']}_{subject['name']}_{i}",
                        "batch": batch['name'],
                        "subject": subject['name']
                    })
        
        # Create a reverse map from class_id to class_info for easy lookup
        class_info_map = {c['id']: c for c in classes_to_schedule}

        # --- 2. CREATE CP-SAT MODEL ---
        model = cp_model.CpModel()
        
        # --- 3. CREATE MODEL VARIABLES ---
        
        # Create a dictionary to hold all assignment variables
        # assigns[(class_id, faculty_id, room_id, day, hour)] = BoolVar
        assigns = {}
        
        # Helper maps for easier lookup
        faculty_subject_map = {f['id']: f['subjects'] for f in faculties_data}
        faculty_availability_map = {f['id']: set(f"{slot['day']}-{slot['hour']}" for slot in f.get('unavailable_slots', [])) for f in faculties_data}

        for c in classes_to_schedule:
            for f_id in all_faculties:
                # Optimization: Only create variables if faculty can teach the subject
                if c['subject'] in faculty_subject_map.get(f_id, []):
                    for r_id in all_classrooms:
                        for d in range(num_days):
                            for h_offset in range(num_hours_per_day):
                                h = start_hour + h_offset
                                # Optimization: Only create variables if faculty is available
                                if f"{d}-{h}" not in faculty_availability_map.get(f_id, set()):
                                    key = (c['id'], f_id, r_id, d, h)
                                    assigns[key] = model.NewBoolVar(f"assign_{c['id']}_{f_id}_{r_id}_{d}_{h}")

        # --- 4. DEFINE HARD CONSTRAINTS (MUST be satisfied) ---

        # a) Each class session is scheduled exactly once
        for c in classes_to_schedule:
            model.AddExactlyOne([assigns[key] for key in assigns if key[0] == c['id']])

        # b) A faculty member can teach at most one class at any given time
        for f_id in all_faculties:
            for d in range(num_days):
                for h_offset in range(num_hours_per_day):
                    h = start_hour + h_offset
                    model.AddAtMostOne([assigns[key] for key in assigns if key[1] == f_id and key[3] == d and key[4] == h])

        # c) A classroom can host at most one class at any given time
        for r_id in all_classrooms:
            for d in range(num_days):
                for h_offset in range(num_hours_per_day):
                    h = start_hour + h_offset
                    model.AddAtMostOne([assigns[key] for key in assigns if key[2] == r_id and key[3] == d and key[4] == h])

        # d) A batch can attend at most one class at any given time
        for b_name in all_batches:
            batch_class_ids = [c['id'] for c in classes_to_schedule if c['batch'] == b_name]
            for d in range(num_days):
                for h_offset in range(num_hours_per_day):
                    h = start_hour + h_offset
                    model.AddAtMostOne([assigns[key] for key in assigns if key[0] in batch_class_ids and key[3] == d and key[4] == h])
        
        # e) Max classes per day for a batch
        for b_name, batch_info in all_batches.items():
            max_classes = batch_info.get('max_classes_per_day', num_hours_per_day)
            batch_class_ids = [c['id'] for c in classes_to_schedule if c['batch'] == b_name]
            for d in range(num_days):
                daily_classes = [assigns[key] for key in assigns if key[0] in batch_class_ids and key[3] == d]
                model.Add(sum(daily_classes) <= max_classes)
        
        # --- 5. DEFINE SOFT CONSTRAINTS (Preferences to optimize) ---
        
        objective_terms = []

        # Helper variables: For each batch, day, and hour, create a boolean variable
        # that is true if the batch has any class scheduled at that time.
        # This is used by multiple soft constraints below.
        batch_has_class_at_hour = {}
        for b_name in all_batches:
            batch_class_ids = {c['id'] for c in classes_to_schedule if c['batch'] == b_name}
            batch_has_class_at_hour[b_name] = {}
            for d in range(num_days):
                batch_has_class_at_hour[b_name][d] = {}
                for h_offset in range(num_hours_per_day):
                    h = start_hour + h_offset
                    var = model.NewBoolVar(f"has_class_{b_name}_{d}_{h}")
                    batch_has_class_at_hour[b_name][d][h] = var
                    
                    classes_at_this_hour = [
                        assigns[key] for key in assigns 
                        if key[0] in batch_class_ids and key[3] == d and key[4] == h
                    ]
                    
                    if not classes_at_this_hour:
                        model.Add(var == 0) # Must be false if no classes are possible
                    else:
                        model.AddMaxEquality(var, classes_at_this_hour)


        # a) Soft Constraint: Minimize gaps in a batch's daily schedule
        if gap_penalty > 0:
            for b_name in all_batches:
                for d in range(num_days):
                    for h_offset in range(1, num_hours_per_day - 1):
                        h = start_hour + h_offset
                        prev_h, next_h = h - 1, h + 1
                        
                        gap_var = model.NewBoolVar(f"gap_{b_name}_{d}_{h}")
                        
                        # A gap exists if there's a class before and after, but not during this hour
                        model.AddBoolAnd([
                            batch_has_class_at_hour[b_name][d][prev_h],
                            batch_has_class_at_hour[b_name][d][h].Not(),
                            batch_has_class_at_hour[b_name][d][next_h]
                        ]).OnlyEnforceIf(gap_var)
                        
                        objective_terms.append(gap_var * gap_penalty)

        # b) Soft Constraint: Penalize having more than 2 contiguous classes for a batch
        if max_contiguous_penalty > 0:
            for b_name in all_batches:
                for d in range(num_days):
                    # A violation occurs if there are classes in 3 consecutive hours.
                    # We check for each possible 3-hour window in the day.
                    for h_offset in range(num_hours_per_day - 2):
                        h1 = start_hour + h_offset
                        h2 = h1 + 1
                        h3 = h2 + 1
                        
                        too_many_contiguous_var = model.NewBoolVar(f"too_many_contiguous_{b_name}_{d}_{h1}")
                        
                        # This variable is true if there are classes in all three consecutive hours.
                        model.AddBoolAnd([
                            batch_has_class_at_hour[b_name][d][h1],
                            batch_has_class_at_hour[b_name][d][h2],
                            batch_has_class_at_hour[b_name][d][h3]
                        ]).OnlyEnforceIf(too_many_contiguous_var)
                        
                        objective_terms.append(too_many_contiguous_var * max_contiguous_penalty)

        # c) Soft Constraint: Penalize scheduling more than one class of the same subject for a batch on the same day
        if subject_spread_penalty > 0:
            for b_name in all_batches:
                batch_class_ids = {c['id'] for c in classes_to_schedule if c['batch'] == b_name}
                for s_name in all_subjects:
                    subject_class_ids = {c['id'] for c_id in batch_class_ids if class_info_map[c_id]['subject'] == s_name}
                    if not subject_class_ids:
                        continue
                        
                    for d in range(num_days):
                        daily_subject_classes = [assigns[key] for key in assigns if key[0] in subject_class_ids and key[3] == d]
                        
                        num_daily = model.NewIntVar(0, len(subject_class_ids), f"num_daily_{b_name}_{s_name}_{d}")
                        model.Add(num_daily == sum(daily_subject_classes))

                        # We want num_daily <= 1. Any amount over 1 is a penalty.
                        overage = model.NewIntVar(0, len(subject_class_ids), f"overage_{b_name}_{s_name}_{d}")
                        model.Add(num_daily <= 1 + overage)

                        objective_terms.append(overage * subject_spread_penalty)

        # Set the objective function for the solver
        model.Minimize(sum(objective_terms))

        # --- 6. SOLVE THE MODEL ---
        solver = cp_model.CpSolver()
        # Optional: Set a time limit for the solver
        solver.parameters.max_time_in_seconds = 30.0
        status = solver.Solve(model)
        
        # --- 7. PROCESS AND RETURN THE SOLUTION ---
        if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
            print(f"Solution found with status: {solver.StatusName()} and objective value: {solver.ObjectiveValue()}", file=sys.stderr)
            solution = []
            
            for key, var in assigns.items():
                if solver.Value(var) == 1:
                    class_id, f_id, r_id, d, h = key
                    class_info = class_info_map[class_id]
                    solution.append({
                        "batch": class_info['batch'],
                        "subject": class_info['subject'],
                        "faculty": f_id,
                        "classroom": r_id,
                        "time_slot": { "day": d, "hour": h }
                    })
            return jsonify(solution)
        else:
            return jsonify({"error": "No solution found. The constraints might be too tight. Try reducing the number of classes or adding more resources."}), 400

    except Exception as e:
        # Log the full error to the console for debugging
        print(f"An error occurred: {e}", file=sys.stderr)
        traceback.print_exc()
        # Return a generic error message to the user
        return jsonify({"error": f"An internal server error occurred: {e}"}), 500


if __name__ == '__main__':
    # Run this file directly to start the microservice
    app.run(debug=True, port=5001)
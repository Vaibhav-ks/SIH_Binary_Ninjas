import React, { useState } from 'react';

// Main App component
export default function App() {
  const [formData, setFormData] = useState({
    settings: {
      working_days: 5,
      hours_per_day: 8,
      start_hour: 9,
      penalties: {
        batch_gap: 1,
        subject_spread: 5,
        max_contiguous: 10,
      },
    },
    classrooms: [
      { id: 'GS 4' },
      { id: 'GS 5' },
      { id: 'GS 6' },
      { id: 'GS 7' },
    ],
    faculties: [
      { id: 'F01', subjects: ['Data Structures', 'Algorithms'], unavailable_slots: [] },
      { id: 'F02', subjects: ['Mathematics'], unavailable_slots: [] },
      { id: 'F03', subjects: ['OOPs'], unavailable_slots: [] },
      { id: 'F04', subjects: ['CA'], unavailable_slots: [] },
    ],
    batches: [
      {
        name: 'CSE-A',
        max_classes_per_day: 6,
        subjects: [
          { name: 'Data Structures', classes_per_week: 4 },
          { name: 'Algorithms', classes_per_week: 3 },
          { name: 'Mathematics', classes_per_week: 2 },
          { name: 'OOPs', classes_per_week: 3 },
          { name: 'CA', classes_per_week: 4 },
        ],
      },
      {
        name: 'CSE-B',
        max_classes_per_day: 6,
        subjects: [
          { name: 'Data Structures', classes_per_week: 4 },
          { name: 'Algorithms', classes_per_week: 3 },
          { name: 'Mathematics', classes_per_week: 2 },
          { name: 'OOPs', classes_per_week: 3 },
          { name: 'CA', classes_per_week: 4 },
        ],
      },
    ],
  });

  const [timetable, setTimetable] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const API_URL = 'http://localhost:3000/generate-timetable';

  // State management for dynamic inputs
  const addBatch = () => {
    const newBatch = {
      name: `New Batch ${formData.batches.length + 1}`,
      max_classes_per_day: 6,
      subjects: [{ name: 'New Subject', classes_per_week: 1 }],
    };
    setFormData((prev) => ({
      ...prev,
      batches: [...prev.batches, newBatch],
    }));
  };

  const removeBatch = (index) => {
    setFormData((prev) => ({
      ...prev,
      batches: prev.batches.filter((_, i) => i !== index),
    }));
  };

  const addSubject = (batchIndex) => {
    const newSubjects = [...formData.batches];
    newSubjects[batchIndex].subjects.push({
      name: `New Subject ${newSubjects[batchIndex].subjects.length + 1}`,
      classes_per_week: 1,
    });
    setFormData((prev) => ({
      ...prev,
      batches: newSubjects,
    }));
  };

  const removeSubject = (batchIndex, subjectIndex) => {
    const newSubjects = [...formData.batches];
    newSubjects[batchIndex].subjects.splice(subjectIndex, 1);
    setFormData((prev) => ({
      ...prev,
      batches: newSubjects,
    }));
  };

  const addFaculty = () => {
    const newFaculty = {
      id: `F${formData.faculties.length + 1}`,
      subjects: [],
      unavailable_slots: [],
    };
    setFormData((prev) => ({
      ...prev,
      faculties: [...prev.faculties, newFaculty],
    }));
  };

  const removeFaculty = (index) => {
    setFormData((prev) => ({
      ...prev,
      faculties: prev.faculties.filter((_, i) => i !== index),
    }));
  };
  
  const addClassroom = () => {
    const newClassroom = { id: `Room-${100 + formData.classrooms.length + 1}` };
    setFormData((prev) => ({
      ...prev,
      classrooms: [...prev.classrooms, newClassroom],
    }));
  };

  const removeClassroom = (index) => {
    setFormData((prev) => ({
      ...prev,
      classrooms: prev.classrooms.filter((_, i) => i !== index),
    }));
  };

  const addUnavailableSlot = (facultyIndex) => {
    const newFaculties = [...formData.faculties];
    newFaculties[facultyIndex].unavailable_slots.push({ day: 0, hour: 9 });
    setFormData((prev) => ({
      ...prev,
      faculties: newFaculties,
    }));
  };

  const removeUnavailableSlot = (facultyIndex, slotIndex) => {
    const newFaculties = [...formData.faculties];
    newFaculties[facultyIndex].unavailable_slots.splice(slotIndex, 1);
    setFormData((prev) => ({
      ...prev,
      faculties: newFaculties,
    }));
  };

  const handleChange = (e, path, type = 'string') => {
    const { name, value } = e.target;
    const newFormData = { ...formData };
    const keys = path.split('.');
    let current = newFormData;
    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = type === 'number' ? Number(value) : value;
    setFormData(newFormData);
  };
  
  // Handle form submission and API call
  const generateTimetable = async () => {
    setLoading(true);
    setError(null);
    setTimetable(null);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Unknown error');
      }

      setTimetable(result);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to render the timetable
  const renderTimetable = () => {
    if (!timetable) {
      return (
        <div className="p-5 border rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 text-gray-700 min-h-[300px] shadow-inner flex items-center justify-center">
          👉 Input your configuration and click "Generate Timetable".
        </div>
      );
    }

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const hours = Array.from({ length: formData.settings.hours_per_day }, (_, i) => formData.settings.start_hour + i);
    const batches = [...new Set(timetable.map((s) => s.batch))].sort();

    const timetableData = {};
    batches.forEach(batch => {
      timetableData[batch] = {};
      days.forEach((day, d_idx) => {
        timetableData[batch][d_idx] = {};
        hours.forEach((hour) => {
          timetableData[batch][d_idx][hour] = null;
        });
      });
    });

    timetable.forEach(slot => {
      timetableData[slot.batch][slot.time_slot.day][slot.time_slot.hour] = slot;
    });

    return (
      <div className="space-y-6">
        {batches.map((batch, batchIndex) => (
          <div key={batchIndex} className="bg-gray-50 rounded-lg p-4 shadow-sm border border-gray-200">
            <h3 className="text-xl font-semibold mb-3 text-indigo-800">{batch} Timetable</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time/Day</th>
                    {days.slice(0, formData.settings.working_days).map((day) => (
                      <th key={day} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {hours.map((hour, hourIndex) => (
                    <tr key={hourIndex}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {hour}:00 - {hour + 1}:00
                      </td>
                      {days.slice(0, formData.settings.working_days).map((day, dayIndex) => {
                        const slot = timetableData[batch][dayIndex][hour];
                        return (
                          <td key={dayIndex} className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {slot ? (
                              <div>
                                <div className="font-bold text-indigo-600">{slot.subject}</div>
                                <div className="text-xs text-gray-500">Faculty: {slot.faculty}</div>
                                <div className="text-xs text-gray-500">Room: {slot.classroom}</div>
                              </div>
                            ) : (
                              <div className="text-gray-400">- Free -</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    );
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-indigo-100 p-6">
      <h1 className="text-4xl font-bold mb-4 text-indigo-700 text-center">
        Schedulify
      </h1>
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Config Panel */}
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-indigo-100">
          <div className="grid grid-cols-1 gap-6">
            {/* Settings Section */}
            <div>
              <h2 className="text-xl font-semibold mb-2 text-gray-700">Settings</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600">Days/Week</label>
                  <input type="number" value={formData.settings.working_days} onChange={(e) => handleChange(e, 'settings.working_days', 'number')} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-400 bg-gray-50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600">Hours/Day</label>
                  <input type="number" value={formData.settings.hours_per_day} onChange={(e) => handleChange(e, 'settings.hours_per_day', 'number')} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-400 bg-gray-50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600">Start Hour</label>
                  <input type="number" value={formData.settings.start_hour} onChange={(e) => handleChange(e, 'settings.start_hour', 'number')} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-400 bg-gray-50" />
                </div>
              </div>
              <h3 className="text-lg font-medium text-gray-600 mt-4 mb-2">Penalties</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600">Batch Gap</label>
                  <input type="number" value={formData.settings.penalties.batch_gap} onChange={(e) => handleChange(e, 'settings.penalties.batch_gap', 'number')} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-400 bg-gray-50 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600">Subject Spread</label>
                  <input type="number" value={formData.settings.penalties.subject_spread} onChange={(e) => handleChange(e, 'settings.penalties.subject_spread', 'number')} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-400 bg-gray-50 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600">Max Contiguous</label>
                  <input type="number" value={formData.settings.penalties.max_contiguous} onChange={(e) => handleChange(e, 'settings.penalties.max_contiguous', 'number')} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-400 bg-gray-50 text-sm" />
                </div>
              </div>
            </div>

            {/* Classrooms Section */}
            <div>
              <h2 className="text-xl font-semibold mb-2 text-gray-700">Classrooms</h2>
              {formData.classrooms.map((room, index) => (
                <div key={index} className="flex items-center space-x-2 mb-2">
                  <input type="text" value={room.id} onChange={(e) => {
                    const newRooms = [...formData.classrooms];
                    newRooms[index].id = e.target.value;
                    setFormData({ ...formData, classrooms: newRooms });
                  }} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-400 bg-gray-50" />
                  <button onClick={() => removeClassroom(index)} className="text-red-500 hover:text-red-700 text-sm">Remove</button>
                </div>
              ))}
              <button onClick={addClassroom} className="w-full mt-2 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300 transition">Add Classroom</button>
            </div>

            {/* Faculties Section */}
            <div>
              <h2 className="text-xl font-semibold mb-2 text-gray-700">Faculties</h2>
              {formData.faculties.map((faculty, index) => (
                <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-medium text-gray-800">Faculty {index + 1}</h3>
                    <button onClick={() => removeFaculty(index)} className="text-red-500 hover:text-red-700 text-sm">Remove</button>
                  </div>
                  <label className="block text-xs font-medium text-gray-600">ID</label>
                  <input type="text" value={faculty.id} onChange={(e) => {
                    const newFaculties = [...formData.faculties];
                    newFaculties[index].id = e.target.value;
                    setFormData({ ...formData, faculties: newFaculties });
                  }} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-400 bg-white" />
                  <label className="block text-xs font-medium text-gray-600 mt-2">Subjects (comma-separated)</label>
                  <input type="text" value={faculty.subjects.join(', ')} onChange={(e) => {
                    const newFaculties = [...formData.faculties];
                    newFaculties[index].subjects = e.target.value.split(',').map(s => s.trim());
                    setFormData({ ...formData, faculties: newFaculties });
                  }} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-400 bg-white" />
                  <h4 className="text-sm font-medium mt-3 mb-1 text-gray-700">Unavailable Slots</h4>
                  {faculty.unavailable_slots.map((slot, s_index) => (
                    <div key={s_index} className="flex items-center space-x-2 mb-1 text-sm">
                      <label className="text-xs font-medium text-gray-600">Day:</label>
                      <input type="number" value={slot.day} onChange={(e) => {
                        const newFaculties = [...formData.faculties];
                        newFaculties[index].unavailable_slots[s_index].day = Number(e.target.value);
                        setFormData({ ...formData, faculties: newFaculties });
                      }} className="w-1/4 p-1 border rounded-lg focus:ring-2 focus:ring-indigo-400 bg-white text-xs" />
                      <label className="text-xs font-medium text-gray-600">Hour:</label>
                      <input type="number" value={slot.hour} onChange={(e) => {
                        const newFaculties = [...formData.faculties];
                        newFaculties[index].unavailable_slots[s_index].hour = Number(e.target.value);
                        setFormData({ ...formData, faculties: newFaculties });
                      }} className="w-1/4 p-1 border rounded-lg focus:ring-2 focus:ring-indigo-400 bg-white text-xs" />
                      <button onClick={() => removeUnavailableSlot(index, s_index)} className="text-red-500 hover:text-red-700 text-xs">Remove</button>
                    </div>
                  ))}
                  <button onClick={() => addUnavailableSlot(index)} className="w-full mt-2 bg-gray-200 text-gray-800 py-1 rounded-lg hover:bg-gray-300 transition text-sm">Add Slot</button>
                </div>
              ))}
              <button onClick={addFaculty} className="w-full mt-2 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300 transition">Add Faculty</button>
            </div>

            {/* Batches Section */}
            <div>
              <h2 className="text-xl font-semibold mb-2 text-gray-700">Batches</h2>
              {formData.batches.map((batch, index) => (
                <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-medium text-gray-800">Batch {index + 1}</h3>
                    <button onClick={() => removeBatch(index)} className="text-red-500 hover:text-red-700 text-sm">Remove</button>
                  </div>
                  <label className="block text-xs font-medium text-gray-600">Name</label>
                  <input type="text" value={batch.name} onChange={(e) => {
                    const newBatches = [...formData.batches];
                    newBatches[index].name = e.target.value;
                    setFormData({ ...formData, batches: newBatches });
                  }} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-400 bg-white" />
                  <label className="block text-xs font-medium text-gray-600 mt-2">Max Classes/Day</label>
                  <input type="number" value={batch.max_classes_per_day} onChange={(e) => {
                    const newBatches = [...formData.batches];
                    newBatches[index].max_classes_per_day = Number(e.target.value);
                    setFormData({ ...formData, batches: newBatches });
                  }} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-400 bg-white" />
                  <h4 className="text-sm font-medium mt-3 mb-1 text-gray-700">Subjects</h4>
                  {batch.subjects.map((subject, s_index) => (
                    <div key={s_index} className="flex items-center space-x-2 mb-1 text-sm">
                      <label className="text-xs font-medium text-gray-600">Name:</label>
                      <input type="text" value={subject.name} onChange={(e) => {
                        const newBatches = [...formData.batches];
                        newBatches[index].subjects[s_index].name = e.target.value;
                        setFormData({ ...formData, batches: newBatches });
                      }} className="w-1/2 p-1 border rounded-lg focus:ring-2 focus:ring-indigo-400 bg-white text-xs" />
                      <label className="text-xs font-medium text-gray-600">Classes/Week:</label>
                      <input type="number" value={subject.classes_per_week} onChange={(e) => {
                        const newBatches = [...formData.batches];
                        newBatches[index].subjects[s_index].classes_per_week = Number(e.target.value);
                        setFormData({ ...formData, batches: newBatches });
                      }} className="w-1/4 p-1 border rounded-lg focus:ring-2 focus:ring-indigo-400 bg-white text-xs" />
                      <button onClick={() => removeSubject(index, s_index)} className="text-red-500 hover:text-red-700 text-xs">Remove</button>
                    </div>
                  ))}
                  <button onClick={() => addSubject(index)} className="w-full mt-2 bg-gray-200 text-gray-800 py-1 rounded-lg hover:bg-gray-300 transition text-sm">Add Subject</button>
                </div>
              ))}
              <button onClick={addBatch} className="w-full mt-2 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300 transition">Add Batch</button>
            </div>
          </div>
          <button
            onClick={generateTimetable}
            disabled={loading}
            className="w-full mt-6 bg-indigo-600 text-white py-3 px-4 rounded-xl shadow-lg hover:bg-indigo-700 transition transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating...
              </>
            ) : (
              'Generate Timetable'
            )}
          </button>
          {error && (
            <div className="mt-4 p-4 text-sm text-red-700 bg-red-100 rounded-lg" role="alert">
              <span className="font-medium">Error:</span> {error}
            </div>
          )}
        </div>

        {/* Right Timetable Display */}
        <div className="md:col-span-2 bg-white rounded-2xl shadow-xl p-6 border border-indigo-100">
          <h2 className="text-2xl font-bold mb-5 text-indigo-700 text-center">
            Generated Timetable
          </h2>
          {renderTimetable()}
        </div>
      </div>
    </div>
  );
}

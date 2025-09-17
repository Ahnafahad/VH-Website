'use client';

// @ts-nocheck
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Plus, Trash2, Check, X } from 'lucide-react';

interface EligibilityCheckerProps {
  onEligibilityUpdate?: (activeTab: string, results: any) => void;
}

// Grade point mappings (moved outside component to avoid recreation on each render)
const ibaGradePoints: Record<string, number> = { 'A': 5.0, 'B': 4.0, 'C': 3.0, 'D': 0.0 };
const bupGradePoints: Record<string, number> = { 'A': 5.0, 'B': 4.0, 'C': 3.5, 'D': 3.0 };
const duScienceGradePoints: Record<string, number> = { 'A': 5.0, 'B': 4.0, 'C': 3.5 };
const businessSubjects = ['business studies', 'accounting', 'economics', 'mathematics', 'statistics'];
const buetRequiredALevel = ['mathematics', 'physics', 'chemistry'];
const grades = ['A', 'B', 'C', 'D'];
const duScienceGrades = ['A', 'B', 'C'];

const UniversityEligibilityChecker = ({ onEligibilityUpdate }: EligibilityCheckerProps) => {
  const [activeTab, setActiveTab] = useState('IBA');
  const [oLevelSubjects, setOLevelSubjects] = useState([
    { id: 'math', name: 'Mathematics', grade: '' }
  ]);
  const [aLevelSubjects, setALevelSubjects] = useState([
    { id: 'a1', name: '', grade: '' }
  ]);

  const updateOLevelSubject = useCallback((id: string, field: string, value: string) => {
    setOLevelSubjects(prev => prev.map(subject => 
      subject.id === id ? { ...subject, [field]: value } : subject
    ));
  }, []);

  const updateALevelSubject = useCallback((id: string, field: string, value: string) => {
    setALevelSubjects(prev => prev.map(subject => 
      subject.id === id ? { ...subject, [field]: value } : subject
    ));
  }, []);

  const addOLevelSubject = () => {
    const newId = `ol${Date.now()}`;
    setOLevelSubjects(prev => [...prev, { id: newId, name: '', grade: '' }]);
  };

  const addALevelSubject = () => {
    const newId = `al${Date.now()}`;
    setALevelSubjects(prev => [...prev, { id: newId, name: '', grade: '' }]);
  };

  const removeOLevelSubject = (id: string) => {
    // Don't allow removal of mandatory subjects
    const buetRequiredIds = ['buet_math', 'buet_physics', 'buet_chemistry', 'buet_english'];
    const isMandatory = (id === 'math' && activeTab === 'IBA') || (buetRequiredIds.includes(id) && activeTab === 'BUET');
    
    if (!isMandatory) {
      setOLevelSubjects(prev => prev.filter(subject => subject.id !== id));
    }
  };

  const removeALevelSubject = (id: string) => {
    setALevelSubjects(prev => prev.filter(subject => subject.id !== id));
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === 'IBA' && !oLevelSubjects.find(s => s.id === 'math')) {
      setOLevelSubjects(prev => [{ id: 'math', name: 'Mathematics', grade: '' }, ...prev]);
    }
    if (tab === 'BUET') {
      // Set required BUET O-Level subjects
      setOLevelSubjects([
        { id: 'buet_math', name: 'Mathematics', grade: '' },
        { id: 'buet_physics', name: 'Physics', grade: '' },
        { id: 'buet_chemistry', name: 'Chemistry', grade: '' },
        { id: 'buet_english', name: 'English', grade: '' }
      ]);
      // Set required BUET A-Level subjects
      setALevelSubjects([
        { id: 'buet_a_math', name: 'Mathematics', grade: '' },
        { id: 'buet_a_physics', name: 'Physics', grade: '' },
        { id: 'buet_a_chemistry', name: 'Chemistry', grade: '' }
      ]);
    }
    if (tab === 'DU Business') {
      // Set required DU Business A-Level subject with business subject dropdown
      setALevelSubjects([
        { id: 'du_business_required', name: 'Business Studies', grade: '' },
        { id: 'a2', name: '', grade: '' }
      ]);
    }
    if ((tab === 'DU Science' || tab === 'DU Business') && oLevelSubjects.find(s => s.id === 'math' && !s.name.trim() && !s.grade)) {
      setOLevelSubjects(prev => prev.filter(s => s.id !== 'math' || s.name.trim() || s.grade));
    }
  };

  const calculateIBAResults = useCallback(() => {
    const validOLevels = oLevelSubjects.filter(s => s.name.trim() && s.grade);
    const validALevels = aLevelSubjects.filter(s => s.name.trim() && s.grade);

    const mathSubject = oLevelSubjects.find(s => s.id === 'math');
    const hasMathWithGrade = mathSubject && mathSubject.grade;

    if (!hasMathWithGrade) {
      return { eligible: false, reason: 'Mathematics is mandatory for O-Levels and must have a grade.' };
    }

    if (validOLevels.length < 5) {
      return { eligible: false, reason: 'Minimum 5 O-Level subjects required.' };
    }

    if (validALevels.length < 2) {
      return { eligible: false, reason: 'Minimum 2 A-Level subjects required.' };
    }

    const oLevelPoints = validOLevels.map(s => ibaGradePoints[s.grade]);
    const mathPoints = ibaGradePoints[mathSubject.grade];
    const otherOLevelPoints = oLevelPoints.filter((_, index) => validOLevels[index].id !== 'math');
    otherOLevelPoints.sort((a, b) => b - a);
    const best4OthersOLevel = otherOLevelPoints.slice(0, 4);
    const best5OLevel = [mathPoints, ...best4OthersOLevel];
    const oLevelCGPA = best5OLevel.reduce((sum, point) => sum + point, 0) / 5;

    const aLevelPoints = validALevels.map(s => ibaGradePoints[s.grade]);
    aLevelPoints.sort((a, b) => b - a);
    const best2ALevel = aLevelPoints.slice(0, 2);
    const aLevelCGPA = best2ALevel.reduce((sum, point) => sum + point, 0) / 2;

    const allSubjects = [...validOLevels, ...validALevels];
    const aGradesCount = allSubjects.filter(s => s.grade === 'A').length;

    const oLevelPass = oLevelCGPA >= 3.5;
    const aLevelPass = aLevelCGPA >= 3.5;
    const minAGrades = aGradesCount >= 2;

    const eligible = oLevelPass && aLevelPass && minAGrades;

    return {
      eligible,
      oLevelCGPA: oLevelCGPA.toFixed(2),
      aLevelCGPA: aLevelCGPA.toFixed(2),
      aGradesCount,
      oLevelPass,
      aLevelPass,
      minAGrades,
      reason: eligible ? 'You meet all IBA eligibility requirements!' : 'Requirements not met.'
    };
  }, [oLevelSubjects, aLevelSubjects]);

  const calculateBUPResults = useCallback(() => {
    const validOLevels = oLevelSubjects.filter(s => s.name.trim() && s.grade);
    const validALevels = aLevelSubjects.filter(s => s.name.trim() && s.grade);

    if (validOLevels.length < 5) {
      return { eligible: false, reason: 'Minimum 5 O-Level subjects required.' };
    }

    if (validALevels.length < 2) {
      return { eligible: false, reason: 'Minimum 2 A-Level subjects required.' };
    }

    const oLevelPoints = validOLevels.map(s => bupGradePoints[s.grade]);
    const aLevelPoints = validALevels.map(s => bupGradePoints[s.grade]);

    oLevelPoints.sort((a, b) => b - a);
    aLevelPoints.sort((a, b) => b - a);

    const best5OLevel = oLevelPoints.slice(0, 5);
    const best2ALevel = aLevelPoints.slice(0, 2);

    const totalPoints = [...best5OLevel, ...best2ALevel].reduce((sum, point) => sum + point, 0);
    const eligible = totalPoints >= 26.5;

    return {
      eligible,
      totalPoints: totalPoints.toFixed(1),
      best5OLevel,
      best2ALevel,
      reason: eligible ? 'You meet all BUP eligibility requirements!' : `Need ${(26.5 - totalPoints).toFixed(1)} more points to qualify.`
    };
  }, [oLevelSubjects, aLevelSubjects]);

  const calculateDUScienceResults = useCallback(() => {
    const validOLevels = oLevelSubjects.filter(s => s.name.trim() && s.grade);
    const validALevels = aLevelSubjects.filter(s => s.name.trim() && s.grade);

    if (validOLevels.length < 5) {
      return { eligible: false, reason: 'Minimum 5 O-Level subjects required.' };
    }

    if (validALevels.length < 2) {
      return { eligible: false, reason: 'Minimum 2 A-Level subjects required.' };
    }

    const allSubjects = [...validOLevels, ...validALevels];
    const hasDGrades = allSubjects.some(s => s.grade === 'D');
    if (hasDGrades) {
      return { eligible: false, reason: 'No D grades are acceptable for DU Science Unit.' };
    }

    const allSubjectsWithPoints = allSubjects.map(s => ({
      ...s,
      points: duScienceGradePoints[s.grade]
    }));
    allSubjectsWithPoints.sort((a, b) => b.points - a.points);
    
    const best7Subjects = allSubjectsWithPoints.slice(0, 7);
    
    const gradeCount: Record<string, number> = { A: 0, B: 0, C: 0 };
    best7Subjects.forEach(s => {
      if (gradeCount[s.grade] !== undefined) {
        gradeCount[s.grade]++;
      }
    });

    const minAGrades = gradeCount.A >= 3;
    const minBGrades = (gradeCount.A + gradeCount.B) >= 5;  // Need at least 5 subjects with B or better (A counts as B+)
    const minCGrades = (gradeCount.A + gradeCount.B + gradeCount.C) >= 7;  // Need at least 7 subjects with C or better (all subjects)
    const totalSubjects = best7Subjects.length >= 7;

    const eligible = minAGrades && minBGrades && minCGrades && totalSubjects;

    return {
      eligible,
      gradeCount,
      best7Subjects,
      minAGrades,
      minBGrades,
      minCGrades,
      totalSubjects,
      reason: eligible ? 'You meet all DU Science Unit eligibility requirements!' : 'Grade distribution requirements not met.'
    };
  }, [oLevelSubjects, aLevelSubjects]);

  const calculateDUBusinessResults = useCallback(() => {
    const validOLevels = oLevelSubjects.filter(s => s.name.trim() && s.grade);
    const validALevels = aLevelSubjects.filter(s => s.name.trim() && s.grade);

    if (validOLevels.length < 5) {
      return { eligible: false, reason: 'Minimum 5 O-Level subjects required.' };
    }

    if (validALevels.length < 2) {
      return { eligible: false, reason: 'Minimum 2 A-Level subjects required.' };
    }

    // Check if a business subject is taken
    const businessSubjectTaken = validALevels.some(s => 
      businessSubjects.some(bizSubject => 
        s.name.toLowerCase().trim() === bizSubject.toLowerCase()
      )
    );

    if (!businessSubjectTaken) {
      return { 
        eligible: false, 
        reason: 'Must take at least one business subject: Business Studies, Accounting, Economics, Mathematics, or Statistics.' 
      };
    }

    // Calculate O-Level and A-Level GPAs (using IBA grade points)
    const oLevelPoints = validOLevels.map(s => ibaGradePoints[s.grade]);
    const aLevelPoints = validALevels.map(s => ibaGradePoints[s.grade]);

    oLevelPoints.sort((a, b) => b - a);
    aLevelPoints.sort((a, b) => b - a);

    const best5OLevel = oLevelPoints.slice(0, 5);
    const best2ALevel = aLevelPoints.slice(0, 2);

    const oLevelGPA = best5OLevel.reduce((sum, point) => sum + point, 0) / 5;
    const aLevelGPA = best2ALevel.reduce((sum, point) => sum + point, 0) / 2;

    const oLevelPass = oLevelGPA >= 3.0;
    const aLevelPass = aLevelGPA >= 3.0;

    const allSubjects = [...validOLevels, ...validALevels];
    
    const gradeCount: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
    allSubjects.forEach(s => {
      if (gradeCount[s.grade] !== undefined) {
        gradeCount[s.grade]++;
      }
    });

    const bPlusCount = gradeCount.A + gradeCount.B;
    const cPlusCount = gradeCount.A + gradeCount.B + gradeCount.C;

    const minBGrades = bPlusCount >= 3;
    const minCGrades = cPlusCount >= 3;

    const eligible = minBGrades && minCGrades && oLevelPass && aLevelPass;

    let reason = '';
    if (!eligible) {
      if (!oLevelPass) reason = `O-Level GPA too low: ${oLevelGPA.toFixed(2)} (need ≥ 3.0)`;
      else if (!aLevelPass) reason = `A-Level GPA too low: ${aLevelGPA.toFixed(2)} (need ≥ 3.0)`;
      else reason = 'Grade distribution requirements not met.';
    } else {
      reason = 'You meet all DU FBS (Business Studies) eligibility requirements!';
    }

    return {
      eligible,
      gradeCount,
      bPlusCount,
      cPlusCount,
      minBGrades,
      minCGrades,
      oLevelGPA: oLevelGPA.toFixed(2),
      aLevelGPA: aLevelGPA.toFixed(2),
      oLevelPass,
      aLevelPass,
      allSubjects,
      businessSubjectTaken,
      reason
    };
  }, [oLevelSubjects, aLevelSubjects]);

  const calculateBUETResults = useCallback(() => {
    const validOLevels = oLevelSubjects.filter(s => s.name.trim() && s.grade);
    const validALevels = aLevelSubjects.filter(s => s.name.trim() && s.grade);

    // Must have at least 5 O-Level subjects
    if (validOLevels.length < 5) {
      return { eligible: false, reason: 'Minimum 5 O-Level subjects required including Mathematics, Physics, Chemistry, and English.' };
    }

    // Check BUET required O-Level subjects (Mathematics, Physics, Chemistry, English) with minimum grade B
    const buetRequiredOLevelSubjects = [
      { id: 'buet_math', name: 'Mathematics' },
      { id: 'buet_physics', name: 'Physics' },
      { id: 'buet_chemistry', name: 'Chemistry' },
      { id: 'buet_english', name: 'English' }
    ];

    const missingOLevelSubjects: string[] = [];
    const lowGradeOLevelSubjects: string[] = [];

    buetRequiredOLevelSubjects.forEach(required => {
      const foundSubject = oLevelSubjects.find(s => s.id === required.id);
      
      if (!foundSubject || !foundSubject.grade) {
        missingOLevelSubjects.push(required.name);
      } else if (foundSubject.grade === 'C' || foundSubject.grade === 'D') {
        lowGradeOLevelSubjects.push(`${required.name} (${foundSubject.grade})`);
      }
    });

    if (missingOLevelSubjects.length > 0) {
      return { 
        eligible: false, 
        reason: `Missing grades for required O-Level subjects: ${missingOLevelSubjects.join(', ')}.`
      };
    }

    if (lowGradeOLevelSubjects.length > 0) {
      return { 
        eligible: false, 
        reason: `O-Level subjects need minimum grade B: ${lowGradeOLevelSubjects.join(', ')}.`
      };
    }

    // Check A-Level requirements: all 3 subjects (Math/Physics/Chemistry) required - 2 with grade A, 1 with grade B minimum
    const aLevelScience = validALevels.filter(s => {
      const name = s.name.toLowerCase().trim();
      return buetRequiredALevel.some(req => name.includes(req.toLowerCase()));
    });

    // Must have all 3 required A-Level subjects
    if (aLevelScience.length < 3) {
      return { 
        eligible: false, 
        reason: 'Must take all 3 A-Level subjects: Mathematics, Physics, Chemistry.'
      };
    }

    const aGradeCount = aLevelScience.filter(s => s.grade === 'A').length;
    const bOrBetterCount = aLevelScience.filter(s => s.grade === 'A' || s.grade === 'B').length;

    // Need minimum 2 A grades from the 3 science subjects
    if (aGradeCount < 2) {
      return { 
        eligible: false, 
        reason: 'Need minimum 2 A grades from the 3 required subjects (Mathematics, Physics, Chemistry).'
      };
    }

    // All 3 subjects must be at least grade B (2 A grades + 1 B grade minimum)
    if (bOrBetterCount < 3) {
      return { 
        eligible: false, 
        reason: 'All 3 A-Level subjects must have minimum grade B (2 A grades + 1 B grade minimum).'
      };
    }

    const eligible = true;

    return {
      eligible,
      aLevelScience,
      aGradeCount,
      bOrBetterCount,
      missingOLevelSubjects,
      lowGradeOLevelSubjects,
      reason: eligible ? 
        'You meet BUET minimum eligibility criteria! Final selection: Top 400 candidates ranked by A-Level Mathematics, Physics, Chemistry grades.' : 
        'Requirements not met.'
    };
  }, [oLevelSubjects, aLevelSubjects]);

  const results: any = useMemo(() => {
    return activeTab === 'IBA' ? calculateIBAResults() : 
           activeTab === 'BUP' ? calculateBUPResults() : 
           activeTab === 'DU Science' ? calculateDUScienceResults() :
           activeTab === 'DU Business' ? calculateDUBusinessResults() :
           calculateBUETResults();
  }, [activeTab, calculateBUETResults, calculateBUPResults, calculateDUBusinessResults, calculateDUScienceResults, calculateIBAResults]);

  // Call the callback whenever results change
  useEffect(() => {
    if (onEligibilityUpdate) {
      onEligibilityUpdate(activeTab, results);
    }
  }, [activeTab, results, onEligibilityUpdate]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-vh-red to-vh-dark-beige rounded-2xl flex items-center justify-center transform rotate-12">
            <div className="w-8 h-8 bg-white rounded-lg transform -rotate-12"></div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-black mb-2">University Eligibility</h1>
          <p className="text-black text-sm sm:text-base">Check your eligibility for IBA DU, BUP, DU Science, DU Business, and BUET</p>
        </div>

        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-xl p-1 shadow-sm border border-gray-700 overflow-x-auto">
            <div className="flex space-x-1">
              <button
                onClick={() => handleTabChange('IBA')}
                className={`px-3 py-3 rounded-lg font-medium text-sm transition-all duration-200 whitespace-nowrap ${
                  activeTab === 'IBA' 
                    ? 'bg-vh-red text-white shadow-md' 
                    : 'text-black hover:text-vh-red hover:bg-gray-50'
                }`}
              >
                IBA (DU)
              </button>
              <button
                onClick={() => handleTabChange('BUP')}
                className={`px-3 py-3 rounded-lg font-medium text-sm transition-all duration-200 whitespace-nowrap ${
                  activeTab === 'BUP' 
                    ? 'bg-vh-dark-beige text-white shadow-md' 
                    : 'text-black hover:text-vh-red hover:bg-gray-50'
                }`}
              >
                BUP
              </button>
              <button
                onClick={() => handleTabChange('DU Science')}
                className={`px-3 py-3 rounded-lg font-medium text-sm transition-all duration-200 whitespace-nowrap ${
                  activeTab === 'DU Science' 
                    ? 'bg-vh-beige text-vh-dark-red shadow-md' 
                    : 'text-black hover:text-vh-red hover:bg-gray-50'
                }`}
              >
                DU Science
              </button>
              <button
                onClick={() => handleTabChange('DU Business')}
                className={`px-3 py-3 rounded-lg font-medium text-sm transition-all duration-200 whitespace-nowrap ${
                  activeTab === 'DU Business' 
                    ? 'bg-vh-light-red text-white shadow-md' 
                    : 'text-black hover:text-vh-red hover:bg-gray-50'
                }`}
              >
                DU FBS
              </button>
              <button
                onClick={() => handleTabChange('BUET')}
                className={`px-3 py-3 rounded-lg font-medium text-sm transition-all duration-200 whitespace-nowrap ${
                  activeTab === 'BUET' 
                    ? 'bg-vh-dark-red text-white shadow-md' 
                    : 'text-black hover:text-vh-red hover:bg-gray-50'
                }`}
              >
                BUET
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-700 overflow-hidden">
            <div className="bg-gradient-to-r from-vh-beige/20 to-vh-dark-beige/20 px-6 py-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-black">O-Level Subjects</h2>
              <p className="text-sm text-black mt-1">
                {activeTab === 'IBA' 
                  ? 'Mathematics mandatory. Best 5 subjects counted.' 
                  : activeTab === 'BUP'
                  ? 'Best 5 subjects counted. No mandatory subjects.'
                  : activeTab === 'DU Science'
                  ? 'Minimum 5 subjects required. Best 7 total subjects counted (O+A Level combined).'
                  : activeTab === 'DU Business'
                  ? 'Minimum 5 subjects required.'
                  : 'Minimum 5 subjects required including Math, Physics, Chemistry, English (all minimum grade B).'}
              </p>
            </div>
            
            <div className="p-6 space-y-3">
              {oLevelSubjects.map((subject) => {
                const buetRequiredIds = ['buet_math', 'buet_physics', 'buet_chemistry', 'buet_english'];
                const isBuetRequired = buetRequiredIds.includes(subject.id) && activeTab === 'BUET';
                const isIbaRequired = subject.id === 'math' && activeTab === 'IBA';
                const isDisabled = isBuetRequired || isIbaRequired;
                const canRemove = !isDisabled;

                return (
                  <div key={subject.id} className="flex gap-3 items-center">
                    <div className="flex-1">
                      <input
                        type="text"
                        placeholder={
                          subject.id === 'math' ? 'Mathematics' :
                          subject.id === 'buet_math' ? 'Mathematics' :
                          subject.id === 'buet_physics' ? 'Physics' :
                          subject.id === 'buet_chemistry' ? 'Chemistry' :
                          subject.id === 'buet_english' ? 'English' :
                          'Subject name'
                        }
                        value={subject.name}
                        onChange={(e) => updateOLevelSubject(subject.id, 'name', e.target.value)}
                        disabled={isDisabled}
                        className="w-full px-4 py-3 border border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-vh-red focus:border-transparent disabled:bg-gray-700 disabled:text-black transition-all"
                      />
                    </div>
                    <div className="w-20">
                      <select
                        value={subject.grade}
                        onChange={(e) => updateOLevelSubject(subject.id, 'grade', e.target.value)}
                        className="w-full px-3 py-3 border border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-vh-red focus:border-transparent bg-white transition-all"
                      >
                        <option value="">Grade</option>
                        {(activeTab === 'DU Science' ? duScienceGrades : grades).map(grade => (
                          <option key={grade} value={grade}>{grade}</option>
                        ))}
                      </select>
                    </div>
                    {canRemove && (
                      <button
                        onClick={() => removeOLevelSubject(subject.id)}
                        className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors touch-manipulation"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                    {!canRemove && (
                      <div className="p-3 w-12 flex items-center justify-center">
                        <div className="w-4 h-4 bg-gray-700 rounded text-xs flex items-center justify-center text-black">
                          ✓
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              
              <button
                onClick={addOLevelSubject}
                className="flex items-center gap-2 text-vh-red hover:text-vh-dark-red font-medium text-sm py-2 transition-colors touch-manipulation"
              >
                <Plus size={16} />
                Add Subject
              </button>
              
              {activeTab === 'BUET' && (
                <div className="text-sm text-black italic">
                  Required subjects (Math, Physics, Chemistry, English) are pre-filled. You need minimum 5 O-Level subjects total.
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-700 overflow-hidden">
            <div className="bg-gradient-to-r from-vh-beige/30 to-vh-dark-beige/30 px-6 py-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-black">A-Level Subjects</h2>
              <p className="text-sm text-black mt-1">
                {activeTab === 'DU Business'
                  ? 'Minimum 2 subjects required. Any subjects allowed. Business Studies / Accounting / Economics / Mathematics / Statistics - any one of these subjects must be taken.'
                  : activeTab === 'BUET'
                  ? 'Must take all 3 subjects: Math, Physics, Chemistry. Need 2 A grades + 1 B grade minimum.'
                  : 'Minimum 2 subjects required. Best 2 subjects counted.'}
              </p>
            </div>
            
            <div className="p-6 space-y-3">
              {aLevelSubjects.map((subject) => {
                const isFirstDUBusiness = activeTab === 'DU Business' && subject.id === 'du_business_required';
                const buetRequiredALevelIds = ['buet_a_math', 'buet_a_physics', 'buet_a_chemistry'];
                const isBuetRequired = buetRequiredALevelIds.includes(subject.id) && activeTab === 'BUET';
                const canRemove = !(activeTab === 'DU Business' && subject.id === 'du_business_required') && !(activeTab === 'BUET' && isBuetRequired);
                
                return (
                  <div key={subject.id} className="flex gap-3 items-center">
                    <div className="flex-1">
                      {isFirstDUBusiness ? (
                        <select
                          value={subject.name}
                          onChange={(e) => updateALevelSubject(subject.id, 'name', e.target.value)}
                          className="w-full px-4 py-3 border border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-vh-dark-beige focus:border-transparent bg-white transition-all"
                        >
                          <option value="">Select business subject</option>
                          {businessSubjects.map(bizSubject => (
                            <option key={bizSubject} value={bizSubject}>{bizSubject}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          placeholder={
                            subject.id === 'buet_a_math' ? 'Mathematics' :
                            subject.id === 'buet_a_physics' ? 'Physics' :
                            subject.id === 'buet_a_chemistry' ? 'Chemistry' :
                            'Subject name'
                          }
                          value={subject.name}
                          onChange={(e) => updateALevelSubject(subject.id, 'name', e.target.value)}
                          disabled={isBuetRequired}
                          className="w-full px-4 py-3 border border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-vh-dark-beige focus:border-transparent transition-all disabled:bg-gray-700 disabled:text-black"
                        />
                      )}
                    </div>
                    <div className="w-20">
                      <select
                        value={subject.grade}
                        onChange={(e) => updateALevelSubject(subject.id, 'grade', e.target.value)}
                        className="w-full px-3 py-3 border border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-vh-dark-beige focus:border-transparent bg-white transition-all"
                      >
                        <option value="">Grade</option>
                        {(activeTab === 'DU Science' ? duScienceGrades : grades).map(grade => (
                          <option key={grade} value={grade}>{grade}</option>
                        ))}
                      </select>
                    </div>
                    {canRemove ? (
                      <button
                        onClick={() => removeALevelSubject(subject.id)}
                        className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors touch-manipulation"
                      >
                        <Trash2 size={16} />
                      </button>
                    ) : (
                      <div className="p-3 w-12 flex items-center justify-center">
                        <div className="w-4 h-4 bg-gray-700 rounded text-xs flex items-center justify-center text-black">
                          ✓
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              
              {activeTab !== 'BUET' && (
                <button
                  onClick={addALevelSubject}
                  className="flex items-center gap-2 text-vh-dark-beige hover:text-vh-dark-red font-medium text-sm py-2 transition-colors touch-manipulation"
                >
                  <Plus size={16} />
                  Add Subject
                </button>
              )}
              
              {activeTab === 'BUET' && (
                <div className="text-sm text-black italic">
                  All required A-Level subjects are pre-filled. Additional subjects can be entered but won't affect eligibility.
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-700 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-6 py-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-black">{activeTab} Eligibility Results</h2>
            </div>
            
            <div className="p-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-4">
                  <h3 className="font-semibold text-black">Requirements Check</h3>
                  <div className="space-y-3">
                    {activeTab === 'IBA' ? (
                      <>
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                          {results.oLevelPass ? 
                            <div className="w-6 h-6 bg-vh-red rounded-full flex items-center justify-center">
                              <Check size={14} className="text-white" />
                            </div> : 
                            <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                              <X size={14} className="text-white" />
                            </div>
                          }
                          <span className="text-sm font-medium">O-Level CGPA ≥ 3.5: {(results as any).oLevelCGPA || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                          {(results as any).aLevelPass ? 
                            <div className="w-6 h-6 bg-vh-red rounded-full flex items-center justify-center">
                              <Check size={14} className="text-white" />
                            </div> : 
                            <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                              <X size={14} className="text-white" />
                            </div>
                          }
                          <span className="text-sm font-medium">A-Level CGPA ≥ 3.5: {(results as any).aLevelCGPA || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                          {(results as any).minAGrades ? 
                            <div className="w-6 h-6 bg-vh-red rounded-full flex items-center justify-center">
                              <Check size={14} className="text-white" />
                            </div> : 
                            <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                              <X size={14} className="text-white" />
                            </div>
                          }
                          <span className="text-sm font-medium">Minimum 2 A grades: {(results as any).aGradesCount || 0} A's</span>
                        </div>
                      </>
                    ) : activeTab === 'BUP' ? (
                      <>
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                          {results.eligible ? 
                            <div className="w-6 h-6 bg-vh-red rounded-full flex items-center justify-center">
                              <Check size={14} className="text-white" />
                            </div> : 
                            <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                              <X size={14} className="text-white" />
                            </div>
                          }
                          <span className="text-sm font-medium">Total Points ≥ 26.5: {(results as any).totalPoints || 'N/A'}</span>
                        </div>
                        <div className="p-3 rounded-xl bg-gray-50 text-sm text-black space-y-1">
                          <div>Best 5 O-Level: {(results as any).best5OLevel?.join(', ') || 'N/A'} points</div>
                          <div>Best 2 A-Level: {(results as any).best2ALevel?.join(', ') || 'N/A'} points</div>
                        </div>
                      </>
                    ) : activeTab === 'DU Science' ? (
                      <>
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                          {(results as any).minAGrades ? 
                            <div className="w-6 h-6 bg-vh-red rounded-full flex items-center justify-center">
                              <Check size={14} className="text-white" />
                            </div> : 
                            <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                              <X size={14} className="text-white" />
                            </div>
                          }
                          <span className="text-sm font-medium">Minimum 3 A grades: {(results as any).gradeCount?.A || 0} A's</span>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                          {(results as any).minBGrades ? 
                            <div className="w-6 h-6 bg-vh-red rounded-full flex items-center justify-center">
                              <Check size={14} className="text-white" />
                            </div> : 
                            <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                              <X size={14} className="text-white" />
                            </div>
                          }
                          <span className="text-sm font-medium">Minimum 2 B grades: {(results as any).gradeCount?.B || 0} B's</span>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                          {(results as any).minCGrades ? 
                            <div className="w-6 h-6 bg-vh-red rounded-full flex items-center justify-center">
                              <Check size={14} className="text-white" />
                            </div> : 
                            <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                              <X size={14} className="text-white" />
                            </div>
                          }
                          <span className="text-sm font-medium">Minimum 2 C grades: {(results as any).gradeCount?.C || 0} C's</span>
                        </div>
                        {(results as any).best7Subjects && (results as any).best7Subjects.length > 0 && (
                          <div className="p-3 rounded-xl bg-gray-50 text-sm text-black">
                            <div className="font-medium mb-1">Best 7 subjects:</div>
                            <div className="space-y-1">
                              {(results as any).best7Subjects.map((subject: any, index: number) => (
                                <div key={index} className="flex justify-between">
                                  <span>{subject.name}</span>
                                  <span className="font-medium">{subject.grade} ({subject.points})</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : activeTab === 'DU Business' ? (
                      <>
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                          {(results as any).oLevelPass ? 
                            <div className="w-6 h-6 bg-vh-red rounded-full flex items-center justify-center">
                              <Check size={14} className="text-white" />
                            </div> : 
                            <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                              <X size={14} className="text-white" />
                            </div>
                          }
                          <span className="text-sm font-medium">O-Level GPA ≥ 3.0: {(results as any).oLevelGPA || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                          {(results as any).aLevelPass ? 
                            <div className="w-6 h-6 bg-vh-red rounded-full flex items-center justify-center">
                              <Check size={14} className="text-white" />
                            </div> : 
                            <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                              <X size={14} className="text-white" />
                            </div>
                          }
                          <span className="text-sm font-medium">A-Level GPA ≥ 3.0: {(results as any).aLevelGPA || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                          {(results as any).minBGrades ? 
                            <div className="w-6 h-6 bg-vh-red rounded-full flex items-center justify-center">
                              <Check size={14} className="text-white" />
                            </div> : 
                            <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                              <X size={14} className="text-white" />
                            </div>
                          }
                          <span className="text-sm font-medium">Minimum 3 subjects with B+: {results.bPlusCount || 0} subjects</span>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                          {(results as any).minCGrades ? 
                            <div className="w-6 h-6 bg-vh-red rounded-full flex items-center justify-center">
                              <Check size={14} className="text-white" />
                            </div> : 
                            <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                              <X size={14} className="text-white" />
                            </div>
                          }
                          <span className="text-sm font-medium">Minimum 3 subjects with C+: {results.cPlusCount || 0} subjects</span>
                        </div>
                        <div className="p-3 rounded-xl bg-gray-50 text-sm text-black">
                          <div className="font-medium mb-1">Grade Distribution (All 7 subjects):</div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>A: {results.gradeCount?.A || 0}</div>
                            <div>B: {results.gradeCount?.B || 0}</div>
                            <div>C: {results.gradeCount?.C || 0}</div>
                            <div>D: {results.gradeCount?.D || 0}</div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                          {!results.missingOLevelSubjects?.length && !results.lowGradeOLevelSubjects?.length ? 
                            <div className="w-6 h-6 bg-vh-red rounded-full flex items-center justify-center">
                              <Check size={14} className="text-white" />
                            </div> : 
                            <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                              <X size={14} className="text-white" />
                            </div>
                          }
                          <span className="text-sm font-medium">O-Level: Minimum 5 subjects including Math, Physics, Chemistry, English (min. grade B)</span>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                          {results.aGradeCount >= 2 ? 
                            <div className="w-6 h-6 bg-vh-red rounded-full flex items-center justify-center">
                              <Check size={14} className="text-white" />
                            </div> : 
                            <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                              <X size={14} className="text-white" />
                            </div>
                          }
                          <span className="text-sm font-medium">A-Level: All 3 subjects required (Math/Physics/Chemistry) with 2 A grades: {results.aGradeCount || 0}/2</span>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                          {results.bOrBetterCount >= 3 ? 
                            <div className="w-6 h-6 bg-vh-red rounded-full flex items-center justify-center">
                              <Check size={14} className="text-white" />
                            </div> : 
                            <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                              <X size={14} className="text-white" />
                            </div>
                          }
                          <span className="text-sm font-medium">All 3 subjects minimum grade B (2A + 1B): {results.bOrBetterCount || 0}/3</span>
                        </div>
                        {results.aLevelScience && results.aLevelScience.length > 0 && (
                          <div className="p-3 rounded-xl bg-gray-50 text-sm text-black">
                            <div className="font-medium mb-1">A-Level Science Subjects:</div>
                            <div className="space-y-1">
                              {results.aLevelScience.map((subject: any, index: number) => (
                                <div key={index} className="flex justify-between">
                                  <span>{subject.name}</span>
                                  <span className="font-medium">{subject.grade}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                          <div className="font-medium mb-1">⚠️ Important Selection Process:</div>
                          <div>Meeting minimum eligibility only qualifies you for ranking. Final selection is based on ranking top 400 candidates using converted A-Level Math/Physics/Chemistry grades.</div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h3 className="font-semibold text-black">Grade Points ({activeTab})</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="p-3 rounded-xl bg-gray-50 text-center">
                      <div className="font-semibold">A</div>
                      <div className="text-black">5.0</div>
                    </div>
                    <div className="p-3 rounded-xl bg-gray-50 text-center">
                      <div className="font-semibold">B</div>
                      <div className="text-black">4.0</div>
                    </div>
                    <div className="p-3 rounded-xl bg-gray-50 text-center">
                      <div className="font-semibold">C</div>
                      <div className="text-black">{activeTab === 'IBA' ? '3.0' : '3.5'}</div>
                    </div>
                    {activeTab !== 'DU Science' && (
                      <div className="p-3 rounded-xl bg-gray-50 text-center">
                        <div className="font-semibold">D</div>
                        <div className="text-black">{activeTab === 'IBA' ? '0.0' : activeTab === 'DU Business' ? '0.1' : activeTab === 'BUET' ? 'Allowed' : '3.0'}</div>
                      </div>
                    )}
                    {activeTab === 'DU Science' && (
                      <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-center">
                        <div className="font-semibold text-red-600">D</div>
                        <div className="text-red-600 text-xs">Not Allowed</div>
                      </div>
                    )}
                  </div>
                  
                  {activeTab === 'DU Science' && (
                    <div className="mt-4 p-3 rounded-xl bg-vh-beige/20 border border-vh-beige">
                      <h4 className="font-semibold text-vh-dark-red text-sm mb-2">Additional Requirements</h4>
                      <div className="text-xs text-vh-red space-y-1">
                        <div>• Best 7 subjects from O+A Level combined</div>
                        <div>• Science/Humanities/Business stream</div>
                        <div>• Grade distribution: 3 A's, 2 B's, 2 C's minimum</div>
                        <div>• No D grades allowed</div>
                      </div>
                    </div>
                  )}
                  
                  {activeTab === 'DU Business' && (
                    <div className="mt-4 p-3 rounded-xl bg-vh-beige/30 border border-vh-dark-beige">
                      <h4 className="font-semibold text-vh-dark-red text-sm mb-2">DU FBS Requirements</h4>
                      <div className="text-xs text-vh-red space-y-1">
                        <div>• O-Level GPA ≥ 3.0 (best 5 subjects)</div>
                        <div>• A-Level GPA ≥ 3.0 (best 2 subjects)</div>
                        <div>• 3 subjects minimum with B+ grades (A or B)</div>
                        <div>• 3 subjects minimum with C+ grades (A, B, or C)</div>
                        <div>• Business subject required (Business Studies, Accounting, Economics, Mathematics, or Statistics)</div>
                      </div>
                    </div>
                  )}
                  
                  {activeTab === 'BUET' && (
                    <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200">
                      <h4 className="font-semibold text-red-900 text-sm mb-2">BUET Engineering Requirements</h4>
                      <div className="text-xs text-red-700 space-y-1">
                        <div>• O-Level: Minimum 5 subjects including Math, Physics, Chemistry, English</div>
                        <div>• All required O-Level subjects minimum grade B</div>
                        <div>• A-Level: All 3 subjects required (Math/Physics/Chemistry)</div>
                        <div>• A-Level grades: 2 A grades + 1 B grade minimum</div>
                        <div>• Final selection: Top 400 candidates ranked by A-Level Math/Physics/Chemistry grades</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className={`mt-6 p-6 rounded-2xl ${results.eligible ? 'bg-vh-beige/20 border border-vh-beige' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex items-center gap-3 mb-3">
                  {results.eligible ? 
                    <div className="w-8 h-8 bg-vh-red rounded-full flex items-center justify-center">
                      <Check size={18} className="text-white" />
                    </div> : 
                    <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                      <X size={18} className="text-white" />
                    </div>
                  }
                  <span className={`font-bold text-lg ${results.eligible ? 'text-vh-dark-red' : 'text-red-800'}`}>
                    {results.eligible ? `ELIGIBLE FOR ${activeTab}` : `NOT ELIGIBLE FOR ${activeTab}`}
                  </span>
                </div>
                <p className={`text-sm ${results.eligible ? 'text-vh-red' : 'text-red-700'}`}>
                  {results.reason}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UniversityEligibilityChecker;
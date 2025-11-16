/**
 * Robust student matching utility with multiple fallback methods
 * Ensures results are found for both admin and student views
 */

export interface StudentData {
  id: string;
  name: string;
  email: string;
  [key: string]: any;
}

export interface TestResults {
  [studentId: string]: any;
}

/**
 * Find a student's result using multiple matching strategies
 * This prevents issues where admin and student views use different ID formats
 *
 * Matching strategies (in order):
 * 1. Direct roleNumbers match (for FBS 7-digit IDs)
 * 2. Student ID from students object (6-digit IBA ID)
 * 3. Email-based lookup then ID match
 * 4. Try all student IDs from students.json
 */
export function findStudentResult(
  testResults: TestResults,
  studentsData: { [key: string]: StudentData },
  userEmail?: string,
  selectedStudentId?: string,
  roleNumbers?: string[]
): { result: any; matchedId: string | null } {

  if (!testResults) {
    return { result: null, matchedId: null };
  }

  // Strategy 1: Use roleNumbers (includes both 6-digit and 7-digit IDs)
  if (roleNumbers && roleNumbers.length > 0) {
    for (const roleNumber of roleNumbers) {
      if (testResults[roleNumber]) {
        console.log('[StudentMatcher] Match via roleNumbers:', roleNumber);
        return { result: testResults[roleNumber], matchedId: roleNumber };
      }
    }
  }

  // Strategy 2: Use selected student ID (admin view)
  if (selectedStudentId && testResults[selectedStudentId]) {
    console.log('[StudentMatcher] Match via selectedStudentId:', selectedStudentId);
    return { result: testResults[selectedStudentId], matchedId: selectedStudentId };
  }

  // Strategy 3: Find student by email, then try their IDs
  if (userEmail) {
    const student = Object.entries(studentsData).find(
      ([, s]) => s.email?.toLowerCase() === userEmail.toLowerCase()
    );

    if (student) {
      const [key, studentObj] = student;

      // Try the key (actual ID from JSON)
      if (testResults[key]) {
        console.log('[StudentMatcher] Match via email->key:', key);
        return { result: testResults[key], matchedId: key };
      }

      // Try the student.id field
      if (studentObj.id && testResults[studentObj.id]) {
        console.log('[StudentMatcher] Match via email->student.id:', studentObj.id);
        return { result: testResults[studentObj.id], matchedId: studentObj.id };
      }
    }
  }

  // Strategy 4: If selectedStudentId provided, find all matching students
  if (selectedStudentId && studentsData) {
    // Find all entries that match this student (by key or id field)
    const matchingIds = Object.entries(studentsData)
      .filter(([key, student]) =>
        key === selectedStudentId ||
        student.id === selectedStudentId ||
        student.email?.toLowerCase() === studentsData[selectedStudentId]?.email?.toLowerCase()
      )
      .map(([key, student]) => [key, student.id])
      .flat()
      .filter(Boolean);

    for (const id of matchingIds) {
      if (testResults[id as string]) {
        console.log('[StudentMatcher] Match via selectedStudentId fallback:', id);
        return { result: testResults[id as string], matchedId: id as string };
      }
    }
  }

  console.warn('[StudentMatcher] No match found. Tried:', {
    roleNumbers,
    selectedStudentId,
    userEmail,
    availableResultIds: Object.keys(testResults).slice(0, 5) + '...'
  });

  return { result: null, matchedId: null };
}

/**
 * Get all possible IDs for a student
 * Used to ensure comprehensive matching
 */
export function getStudentIds(
  studentsData: { [key: string]: StudentData },
  email?: string,
  selectedId?: string
): string[] {
  const ids = new Set<string>();

  // Add selected ID
  if (selectedId) {
    ids.add(selectedId);
  }

  // Find by email
  if (email) {
    Object.entries(studentsData).forEach(([key, student]) => {
      if (student.email?.toLowerCase() === email.toLowerCase()) {
        ids.add(key);
        if (student.id) ids.add(student.id);
      }
    });
  }

  // Find by selected ID (all variants)
  if (selectedId && studentsData[selectedId]) {
    const student = studentsData[selectedId];
    if (student.id) ids.add(student.id);

    // Find other entries with same email
    if (student.email) {
      Object.entries(studentsData).forEach(([key, s]) => {
        if (s.email?.toLowerCase() === student.email?.toLowerCase()) {
          ids.add(key);
          if (s.id) ids.add(s.id);
        }
      });
    }
  }

  return Array.from(ids);
}

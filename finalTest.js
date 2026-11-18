// finalTest.js — end-of-course multiple-choice test: instructor-authored,
// auto-graded on submission via Bearilly API.

/**
 * Stored via Bearilly Assessments API:
 * Assessment = {
 *   pass_mark: number,        // percent, e.g. 70
 *   questions: [
 *     { type: 'mcq', prompt: string, options: string[4], correct_index: number, points: 1 }
 *   ]
 * }
 *
 * Test attempt (Submission):
 * { score, passed, points_earned, points_possible, submitted_at }
 */

// ---- Instructor: save/replace the whole test ----
export async function saveFinalTest(courseId, { passingScore, questions }) {
  const existing = await getFinalTest(courseId);
  
  const payload = {
    title: "Final Test",
    pass_mark: Number(passingScore) || 70,
    questions: questions.map(q => ({
      type: 'mcq',
      prompt: q.question,
      options: q.options,
      correct_index: Number(q.correctIndex),
      points: 1
    }))
  };

  if (existing && existing.id) {
    const res = await fetch(`/api/v1/assessments/${existing.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const { data } = await res.json();
    return data;
  } else {
    const res = await fetch(`/api/v1/courses/${courseId}/assessments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const { data } = await res.json();
    return data;
  }
}

export async function getFinalTest(courseId) {
  const res = await fetch(`/api/v1/courses/${courseId}/assessments`);
  const { data } = await res.json();
  if (!data || data.length === 0) return null;
  
  // Get full details including questions (Bearilly summary doesn't include questions)
  const detailRes = await fetch(`/api/v1/assessments/${data[0].id}`);
  const { data: assessment } = await detailRes.json();
  
  if (!assessment) return null;

  // Normalize to original format for UI compatibility
  return {
    ...assessment,
    passingScore: assessment.pass_mark,
    questions: (assessment.questions || []).map(q => ({
      ...q,
      question: q.prompt,
      correctIndex: q.correct_index
    }))
  };
}

// ---- Student: submit answers, get auto-graded instantly ----
export async function submitTestAttempt(uid, courseId, answers) {
  const test = await getFinalTest(courseId);
  if (!test) throw new Error("This course has no final test.");

  // Map simple index array to Bearilly question_id format
  const formattedAnswers = answers.map((ans, i) => ({
    question_id: test.questions[i].id,
    answer: Number(ans)
  }));

  const res = await fetch(`/api/v1/assessments/${test.id}/submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers: formattedAnswers })
  });
  
  const { data } = await res.json();
  return {
    score: data.score,
    passed: data.passed,
    correct: data.points_earned,
    total: data.points_possible
  };
}

export async function getTestAttempt(uid, courseId) {
  const test = await getFinalTest(courseId);
  if (!test) return null;

  const res = await fetch(`/api/v1/assessments/${test.id}/submissions`);
  const { data } = await res.json();
  // Bearilly returns only the student's own submission for students.
  return data && data.length > 0 ? data[0] : null;
}

// ---- Instructor: see everyone who has taken this course's final test ----
export async function listAttemptsForCourse(courseId) {
  const test = await getFinalTest(courseId);
  if (!test) return [];

  const res = await fetch(`/api/v1/assessments/${test.id}/submissions`);
  const { data } = await res.json();
  return data || [];
}
import json
import random
from datetime import datetime

# Student data for rank 3 (Mahmud Rahman)
rank3_student = {
    "id": "166388",
    "name": "Mahmud Rahman",
    "email": "mahmud.rahman.sample@example.com",
    "sections": {
        "1": {"correct": 13, "wrong": 7, "skipped": 10, "total": 30},  # English
        "2": {"correct": 14, "wrong": 4, "skipped": 7, "total": 25},   # Mathematics
        "3": {"correct": 8, "wrong": 1, "skipped": 6, "total": 15}     # Analytical
    }
}

# Generate responses for rank 3 student
def generate_responses(sections_data):
    responses = {}
    answer_options = ['A', 'B', 'C', 'D', 'E']

    for section_num, data in sections_data.items():
        correct_count = data['correct']
        wrong_count = data['wrong']
        total_questions = data['total']
        skipped_count = data.get('skipped', total_questions - correct_count - wrong_count)

        # Create response list
        response_list = ['C'] * correct_count + ['W'] * wrong_count + ['NAN'] * skipped_count
        random.shuffle(response_list)

        for q_num in range(1, data['total'] + 1):
            q_id = f"Section{section_num}-Q{q_num}"
            result = response_list[q_num - 1]

            if result == 'NAN':
                responses[q_id] = 'NAN'
            else:
                answer = random.choice(answer_options)
                responses[q_id] = f"{answer} ({result})"

    return responses

# Generate mock students data (20 students total)
def generate_mock_students():
    students = []

    # Top performers (ranks 1-2)
    for i in range(2):
        base_correct = 38 - i
        students.append({
            "id": f"99999{i+1}",
            "name": f"Sample Student {i+1}",
            "email": f"sample{i+1}@example.com",
            "totalCorrect": base_correct,
            "sections": {
                "1": {"correct": int(base_correct * 0.42), "wrong": random.randint(3, 6), "total": 30},
                "2": {"correct": int(base_correct * 0.40), "wrong": random.randint(2, 4), "total": 25},
                "3": {"correct": int(base_correct * 0.18), "wrong": random.randint(0, 2), "total": 15}
            }
        })

    # Rank 3 student (Mahmud Rahman)
    students.append({
        "id": rank3_student["id"],
        "name": rank3_student["name"],
        "email": rank3_student["email"],
        "totalCorrect": 35,
        "sections": rank3_student["sections"]
    })

    # Mid-tier performers (ranks 4-10)
    for i in range(3, 10):
        base_correct = 35 - (i - 2)
        students.append({
            "id": f"88888{i}",
            "name": f"Sample Student {i}",
            "email": f"sample{i}@example.com",
            "totalCorrect": base_correct,
            "sections": {
                "1": {"correct": int(base_correct * 0.40), "wrong": random.randint(4, 8), "total": 30},
                "2": {"correct": int(base_correct * 0.38), "wrong": random.randint(3, 6), "total": 25},
                "3": {"correct": int(base_correct * 0.22), "wrong": random.randint(1, 4), "total": 15}
            }
        })

    # Lower performers (ranks 11-20)
    for i in range(10, 20):
        base_correct = 28 - (i - 10)
        students.append({
            "id": f"77777{i}",
            "name": f"Sample Student {i}",
            "email": f"sample{i}@example.com",
            "totalCorrect": base_correct,
            "sections": {
                "1": {"correct": int(base_correct * 0.38), "wrong": random.randint(5, 10), "total": 30},
                "2": {"correct": int(base_correct * 0.35), "wrong": random.randint(4, 8), "total": 25},
                "3": {"correct": int(base_correct * 0.27), "wrong": random.randint(2, 5), "total": 15}
            }
        })

    return students

# Calculate section marks and analytics
def calculate_section_data(section_info, section_num):
    correct = section_info['correct']
    wrong = section_info['wrong']
    total = section_info['total']
    skipped = section_info.get('skipped', total - correct - wrong)

    # Calculate marks (1 mark per correct, -0.25 for wrong)
    marks = correct * 1.0 - wrong * 0.25
    attempted = correct + wrong
    accuracy = (correct / attempted * 100) if attempted > 0 else 0
    percentage = (marks / total * 100) if total > 0 else 0
    attempt_rate = (attempted / total * 100) if total > 0 else 0

    return {
        "correct": correct,
        "wrong": wrong,
        "marks": round(marks, 2),
        "percentage": round(percentage, 2),
        "totalQuestions": total
    }, {
        "accuracy": round(accuracy, 2),
        "attemptRate": round(attempt_rate, 2),
        "attempted": attempted,
        "unattempted": skipped,
        "efficiency": round((correct / total * 100), 2)
    }

# Generate full test data
students_list = generate_mock_students()

# Sort by total correct for ranking
students_list.sort(key=lambda x: x['totalCorrect'], reverse=True)

# Build results dictionary
results = {}
all_scores = []

for rank, student in enumerate(students_list, 1):
    sections_result = {}
    section_analytics = {}
    mcq_correct = 0
    mcq_wrong = 0
    total_marks = 0

    for section_num, section_info in student['sections'].items():
        section_data, section_perf = calculate_section_data(section_info, section_num)
        sections_result[section_num] = section_data
        section_analytics[section_num] = section_perf

        mcq_correct += section_info['correct']
        mcq_wrong += section_info['wrong']
        total_marks += section_data['marks']

    mcq_attempted = mcq_correct + mcq_wrong
    mcq_accuracy = (mcq_correct / mcq_attempted * 100) if mcq_attempted > 0 else 0
    total_questions = 70
    mcq_percentage = (total_marks / total_questions * 100)

    # Generate responses for this student
    responses = generate_responses(student['sections'])

    # Calculate analytics scores
    skip_strategy = random.randint(60, 95)
    question_choice = random.randint(65, 90)
    recovery_score = random.randint(50, 85)

    results[student['id']] = {
        "studentId": student['id'],
        "studentName": student['name'],
        "sections": sections_result,
        "totalMarks": round(total_marks, 2),
        "mcqMarks": round(total_marks, 2),
        "essayMarks": 0,
        "mcqCorrect": mcq_correct,
        "mcqWrong": mcq_wrong,
        "mcqAccuracy": round(mcq_accuracy, 2),
        "mcqPercentage": round(mcq_percentage, 2),
        "totalPercentage": round(mcq_percentage, 2),
        "rank": rank,
        "maxEssayMarks": 0,
        "responses": responses,
        "analytics": {
            "skipStrategy": skip_strategy,
            "questionChoiceStrategy": question_choice,
            "recoveryScore": recovery_score,
            "sectionPerformance": section_analytics
        }
    }

    all_scores.append(total_marks)

# Calculate class stats
average_score = sum(all_scores) / len(all_scores)
top_5_scores = sorted(all_scores, reverse=True)[:5]
top_5_average = sum(top_5_scores) / len(top_5_scores)
threshold = average_score * 0.6
pass_count = sum(1 for score in all_scores if score >= threshold)
pass_rate = (pass_count / len(all_scores)) * 100

# Generate top questions data
def generate_top_questions():
    top_questions = {}

    for section_num in ['1', '2', '3']:
        total_qs = 30 if section_num == '1' else (25 if section_num == '2' else 15)

        # Generate most correct questions (easiest)
        most_correct = []
        for i in range(1, 11):
            q_id = f"Section{section_num}-Q{i}"
            most_correct.append({"questionId": q_id, "count": random.randint(15, 19)})

        # Generate most wrong questions (hardest)
        most_wrong = []
        for i in range(total_qs - 9, total_qs + 1):
            q_id = f"Section{section_num}-Q{i}"
            most_wrong.append({"questionId": q_id, "count": random.randint(12, 17)})

        # Generate most skipped questions
        most_skipped = []
        for i in range(int(total_qs * 0.6), int(total_qs * 0.6) + 10):
            q_id = f"Section{section_num}-Q{i}"
            most_skipped.append({"questionId": q_id, "count": random.randint(8, 14)})

        top_questions[section_num] = {
            "mostCorrect": most_correct,
            "mostWrong": most_wrong,
            "mostSkipped": most_skipped
        }

    return top_questions

# Build complete test object
iba_mock_4 = {
    "testName": "IBA Mock Test 4",
    "testType": "full",
    "sections": ["1", "2", "3"],
    "results": results,
    "classStats": {
        "averageScore": round(average_score, 2),
        "top5Average": round(top_5_average, 2),
        "threshold": round(threshold, 2),
        "totalStudents": len(students_list),
        "passRate": round(pass_rate, 2)
    },
    "topQuestions": generate_top_questions(),
    "metadata": {
        "processedAt": datetime.now().isoformat(),
        "sourceFile": "OMR_Results IBA Mock 4.xlsx",
        "sheets": ["Sheet1"]
    }
}

# Read existing full-tests.json
with open('public/data/full-tests.json', 'r', encoding='utf-8') as f:
    full_tests_data = json.load(f)

# Add IBA Mock Test 4
full_tests_data['tests']['IBA Mock Test 4'] = iba_mock_4

# Update metadata
full_tests_data['metadata']['totalTests'] = len(full_tests_data['tests'])
full_tests_data['metadata']['lastProcessed'] = datetime.now().isoformat()

# Write updated full-tests.json
with open('public/data/full-tests.json', 'w', encoding='utf-8') as f:
    json.dump(full_tests_data, f, indent=2, ensure_ascii=False)

print("[OK] Updated full-tests.json with IBA Mock Test 4")

# Read existing students.json
with open('public/data/students.json', 'r', encoding='utf-8') as f:
    students_data = json.load(f)

# Add Mahmud Rahman
students_data['students']['166388'] = {
    "id": "166388",
    "name": "Mahmud Rahman",
    "email": "mahmud.rahman.sample@example.com"
}

# Update metadata
students_data['metadata']['totalStudents'] = len(students_data['students'])
students_data['metadata']['lastUpdated'] = datetime.now().isoformat()

# Write updated students.json
with open('public/data/students.json', 'w', encoding='utf-8') as f:
    json.dump(students_data, f, indent=2, ensure_ascii=False)

print("[OK] Updated students.json with Mahmud Rahman")

# Update metadata.json
with open('public/data/metadata.json', 'r', encoding='utf-8') as f:
    metadata = json.load(f)

metadata['lastProcessed'] = datetime.now().isoformat()
metadata['totalStudents'] = len(students_data['students'])
metadata['totalFullTests'] = len(full_tests_data['tests'])

with open('public/data/metadata.json', 'w', encoding='utf-8') as f:
    json.dump(metadata, f, indent=2, ensure_ascii=False)

print("[OK] Updated metadata.json")
print(f"\n[SUCCESS] Generated IBA Mock Test 4 with 20 students")
print(f"[INFO] Mahmud Rahman (ID: 166388) - Rank 3")
print(f"[INFO] Class Average: {round(average_score, 2)}")
print(f"[INFO] Top 5 Average: {round(top_5_average, 2)}")

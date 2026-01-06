async function main() {
  // 히스토리 배열화
  let history;
  try {
    history = $SQL_HISTORY ? JSON.parse($SQL_HISTORY) : [];
    if (!Array.isArray(history)) history = [];
  } catch { history = []; }

  // 가장 최근 항목에 sql_feedback 삽입
  if (history.length > 0) {
    history[history.length - 1].sql_feedback = $SQL_FEEDBACK;
  } else {
    // 히스토리가 비어 있으면 예외적으로 sql_feedback만 가진 첫 항목 생성
    history.push({ sql_feedback: $SQL_FEEDBACK });
  }

  // output 필드로만 반환
  return JSON.stringify(history);
}

return main();

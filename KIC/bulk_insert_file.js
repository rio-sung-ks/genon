const mysql = require('mysql2/promise');

// file_check 플래그 확인
if ($file_check !== "YES") {
    // file_check = NO 이면 DB 작업 건너뛰고 빈 값 반환
    return JSON.stringify({ "OK": "" });
}

let data_json_str = $vars.genosUploaded;

// 문자열로 강제 변환
data_json_str = String(data_json_str);

// <doc> 태그 먼저 제거
data_json_str = data_json_str.replace(/<\/?doc\b[^>]*>/g, '').trim();

console.log('doc 태그 제거 후 처음 100자:', data_json_str.substring(0, 100));

// 첫 번째 완전한 JSON 객체만 추출
if (data_json_str.match(/}\s*{/)) {
    let brace_count = 0;
    let first_json_end = -1;
    
    for (let i = 0; i < data_json_str.length; i++) {
        if (data_json_str[i] === '{') brace_count++;
        if (data_json_str[i] === '}') {
            brace_count--;
            if (brace_count === 0) {
                first_json_end = i;
                break;
            }
        }
    }
    
    if (first_json_end > -1) {
        data_json_str = data_json_str.substring(0, first_json_end + 1);
        console.log('첫 번째 JSON만 추출 완료, 길이:', data_json_str.length);
    }
}

const HOST = $rdb_host; // dwmyoung-mysql9.mysql.database.azure.com
const PORT = Number($rdb_port); // 3306
const USER = $rdb_user; // dwmyoung
const PASSWORD = $rdb_password;
const DATABASE = 'uploaded';

try {
    // 문자열 전처리 및 JSON 파싱
    let data_json = data_json_str
        .replace(/\"[^\"]*\'[^\"]*\"/g, match => match.replace(/\'/g, '\`'))
        .replace(/\'/g, '"')
        .replace('"null"', 'null');

    console.log('JSON 파싱 시도 중...');
    data_json = JSON.parse(data_json);
    data_json = data_json["data"];  
    console.log('JSON 파싱 성공, 시트 개수:', data_json.length);

    // DB 연결
    const connection = await mysql.createConnection({
        host: HOST,
        port: PORT,
        user: USER,
        password: PASSWORD,
        multipleStatements: true
    });

    // DB 초기화
    await connection.query(`
        DROP DATABASE IF EXISTS ${DATABASE};
        CREATE DATABASE ${DATABASE} DEFAULT CHARSET=utf8mb4;
        USE ${DATABASE};
    `);

    // 데이터 삽입
    const table_names = [];

    for (const sheet of data_json) {
        const table_name = sheet.sheet_name;
        const rows_lst = sheet.data_rows;
        const dtypes = sheet.data_types;
        table_names.push(table_name);

        let dtypes_str = '';
        let columns = '';

        for (let i = 0; i < dtypes.length; i++) {
            const column = `\`${dtypes[i][0]}\``;
            const tmp = `\`${dtypes[i][0]}\` ${dtypes[i][1]}`;
            if (i === dtypes.length - 1) {
                dtypes_str += tmp;
                columns += column;
            } else {
                dtypes_str += tmp + ', ';
                columns += column + ', ';
            }
        }

        console.log(`테이블 생성: ${table_name}`);
        await connection.query(
            'CREATE TABLE IF NOT EXISTS ?? (' + dtypes_str + ')',
            [table_name]
        );

        const row_values_arr = rows_lst.map(r => Object.values(r));

        console.log(`데이터 삽입: ${table_name} (${row_values_arr.length}행)`);
        await connection.query(
            'INSERT INTO ?? (' + columns + ') VALUES ?',
            [table_name, row_values_arr]
        );
    }

    await connection.end();
    const res = { "OK": Array.from(new Set(table_names)) };
    console.log('모든 작업 완료:', res);
    return JSON.stringify(res);

} catch (err) {
    console.error('DB 오류:', err);
    console.error('에러 발생 위치 근처 데이터 (300자):', data_json_str.substring(Math.max(0, err.message.includes('position') ? parseInt(err.message.match(/\d+/)[0]) - 50 : 0), Math.max(300, err.message.includes('position') ? parseInt(err.message.match(/\d+/)[0]) + 50 : 300)));
    return JSON.stringify({
        error: err.message,
        data_length: data_json_str.length,
        first_200_chars: data_json_str.substring(0, 200)
    });
}

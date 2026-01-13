const { Client } = require('pg');

let cleanQuery = '';
let client;

try {
    // 1. SQL 입력 검증
    if (!$SQL_QUERY || typeof $SQL_QUERY !== 'string') {
        throw new Error('SQL_QUERY가 필요하며 문자열 형태여야 합니다.');
    }

    cleanQuery = $SQL_QUERY.trim();
    if (!cleanQuery) {
        throw new Error('SQL_QUERY가 비어있습니다.');
    }

    // 2. 하드코딩된 Supabase DB 설정 (제공해주신 정보)
    const dbConfig = {
        host: 'aws-1-ap-south-1.pooler.supabase.com',
        port: 6543,
        user: 'postgres.kqifwoyewzjknqcyubps',
        password: 'Genon1234!@#$', // 🟢 필수 수정
        database: 'postgres',
        ssl: { rejectUnauthorized: false } // 🟢 Supabase 연결 필수 옵션
    };
    
    // 3. DB 연결
    client = new Client(dbConfig);
    await client.connect();
    
    console.log(`Executing SQL: ${cleanQuery.slice(0, 100)}${cleanQuery.length > 100 ? '...' : ''}`);

    // 4. 쿼리 실행
    const result = await client.query(cleanQuery);
    const rows = result.rows;
    const fields = result.fields;

    // 5. 컬럼 단위(Column-oriented) 데이터 변환
    const columnOrientedData = {};
    if (Array.isArray(rows) && rows.length > 0 && fields) {
        for (const field of fields) {
            columnOrientedData[field.name] = rows.map(row => row[field.name]);
        }
    }

    // 6. 결과 길이 제한 확인 (AI 프롬프트 주입용)
    const columnJson = JSON.stringify(columnOrientedData);
    const MAX_LENGTH = 6000;

    if (columnJson.length > MAX_LENGTH) {
        return {
            success: true,
            columns: {
                message: `결과 데이터가 너무 커서 요약되었습니다. (약 ${columnJson.length.toLocaleString()}자)\n조건을 추가하여 데이터 양을 줄여주세요.`
            }
        };
    }

    // 정상 결과 반환
    return {
        success: true,
        columns: columnOrientedData,
        data: rows,
        rowCount: result.rowCount
    };

} catch (error) {
    console.error('SQL 실행 오류:', error);

    // 🟢 PostgreSQL 전용 에러 맵핑 (Postgres 에러 코드는 숫자가 아닌 5자리 문자열입니다)
    const errorMap = {
        '42P01': { type: 'TABLE_NOT_FOUND',  msg: `테이블을 찾을 수 없습니다.` },
        '42703': { type: 'COLUMN_NOT_FOUND', msg: `컬럼을 찾을 수 없습니다.` },
        '42601': { type: 'SYNTAX_ERROR',     msg: `SQL 문법 오류가 발생했습니다.` },
        '28P01': { type: 'ACCESS_DENIED',    msg: `비밀번호가 틀렸거나 접근 권한이 없습니다.` },
        '08006': { type: 'CONNECTION_LOST',  msg: `데이터베이스 연결이 끊어졌습니다.` },
        'ECONNREFUSED': { type: 'CONNECTION_ERROR', msg: 'DB 연결에 실패했습니다 (Host/Port 확인 필요)' }
    };

    const mapped = errorMap[error.code] ?? {
        type: error.code ?? 'UNKNOWN_ERROR',
        msg:  error.message
    };

    return {
        success: false,
        error: {
            type: mapped.type,
            message: mapped.msg,
            original_message: error.message,
            code: error.code
        },
        query: cleanQuery || $SQL_QUERY,
        timestamp: new Date().toISOString()
    };

} finally {
    // 7. 연결 종료
    if (client) {
        try {
            await client.end();
            console.log('Postgres 연결 종료');
        } catch (closeError) {
            console.warn('연결 종료 중 에러:', closeError.message);
        }
    }
}
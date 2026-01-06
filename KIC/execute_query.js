const mysql = require('mysql2/promise');

let cleanQuery = '';
let connection;

try {
    // SQL 입력 검증
    if (!$SQL_QUERY || typeof $SQL_QUERY !== 'string') {
        throw new Error('SQL_QUERY is required and must be a string');
    }

    cleanQuery = $SQL_QUERY.trim();
    if (!cleanQuery) {
        throw new Error('SQL_QUERY cannot be empty');
    }


    const requiredVars = [$rdb_host, $rdb_port, $rdb_user, $rdb_password, $rdb_database];
    if (requiredVars.some(v => !v)) {
        throw new Error("Missing required DB config: one of host/port/user/password is undefined");
    }
  
    dbConfig = {
        host:     $rdb_host,    // dwmyoung-mysql9.mysql.database.azure.com
        port:     Number($rdb_port),    // 3306
        user:     $rdb_user,    // dwmyoung
        password: $rdb_password,
        database: $rdb_database
    };
    
    // DB 연결
    connection = await mysql.createConnection(dbConfig);
    
    console.log(`Executing SQL: ${cleanQuery.slice(0, 100)}${cleanQuery.length > 100 ? '...' : ''}`);

    // 쿼리 실행
    const [rows, fields] = await connection.execute(cleanQuery);

    // 컬럼 단위로 변환
    const columnOrientedData = {};
    if (Array.isArray(rows) && rows.length > 0) {
        for (const field of fields) {
            columnOrientedData[field.name] = rows.map(row => row[field.name]);
        }
    }

    // 결과 길이 제한 확인
    const columnJson = JSON.stringify(columnOrientedData);
    const MAX_LENGTH = 6000;

    if (columnJson.length > MAX_LENGTH) {
        return {
            success: true,
            columns: {
                message: `쿼리는 정상적으로 실행되었지만, 결과가 약 ${columnJson.length.toLocaleString()}자에 달하여 3,000자를 초과하였습니다.\n\n너무 많은 실행 결과를 불러일으키지 않도록 쿼리 조건을 제한하여 다시 시도해주세요.`
            }
        };
    }

    // 정상 결과 반환
    return {
        success: true,
        columns: columnOrientedData,
        data: rows,
    };

} catch (error) {
    console.error('SQL 실행 오류:', error);

    const errorMap = {
        ER_NO_SUCH_TABLE:        { type: 'TABLE_NOT_FOUND',  msg: `테이블을 찾을 수 없습니다: ${error.message}` },
        ER_BAD_FIELD_ERROR:      { type: 'COLUMN_NOT_FOUND', msg: `컬럼을 찾을 수 없습니다: ${error.message}` },
        ER_PARSE_ERROR:          { type: 'SYNTAX_ERROR',     msg: `SQL 문법 오류: ${error.message}` },
        ECONNREFUSED:            { type: 'CONNECTION_ERROR', msg: '데이터베이스 연결에 실패했습니다' },
        ER_ACCESS_DENIED_ERROR:  { type: 'ACCESS_DENIED',    msg: '데이터베이스 접근 권한이 없습니다' },
        PROTOCOL_CONNECTION_LOST:{ type: 'CONNECTION_LOST',  msg: '데이터베이스 연결이 끊어졌습니다' }
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
            code: error.code ?? null,
            errno: error.errno ?? null,
            sql_state: error.sqlState ?? null
        },
        query: cleanQuery || $SQL_QUERY,
        timestamp: new Date().toISOString()
    };

} finally {
    // 연결 종료
    if (connection) {
        try {
            await connection.end();
            console.log('DB 연결 종료');
        } catch (closeError) {
            console.warn('DB 연결 종료 중 에러:', closeError.message);
        }
    }
}

const pg = require('pg');

// 🟢 DB 접속 정보 하드코딩 (제공해주신 정보 적용)
const config = {
    host: 'aws-1-ap-south-1.pooler.supabase.com',
    port: 6543,
    user: 'postgres.kqifwoyewzjknqcyubps',
    password: 'Genon1234!@#$', // 👈 여기만 실제 비밀번호로 수정하세요!
    database: 'postgres',
    ssl: { rejectUnauthorized: false } // 🟢 Supabase 필수: 없으면 접속 거부됨
};

const client = new pg.Client(config);

try {
    await client.connect();

    // 1. DB에 존재하는 모든 사용자 테이블 목록 가져오기
    const tableListRes = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    
    const tableNames = tableListRes.rows.map(r => r.table_name);
    const schemaList = [];

    // 2. 각 테이블별 상세 정보 추출
    for (const tableName of tableNames) {
        const columnsData = await client.query(`
            SELECT 
                cols.column_name AS "COLUMN_NAME",
                cols.data_type AS "DATA_TYPE",
                (SELECT 'PRI' FROM information_schema.key_column_usage kcu
                 WHERE kcu.table_name = cols.table_name 
                   AND kcu.column_name = cols.column_name 
                   AND kcu.table_schema = cols.table_schema
                   LIMIT 1) AS "COLUMN_KEY"
            FROM information_schema.columns cols
            WHERE cols.table_schema = 'public' AND cols.table_name = $1
            ORDER BY cols.ordinal_position
        `, [tableName]);

        const minimalColumns = [];
        for (const col of columnsData.rows) {
            let colInfo = {
                name: col.COLUMN_NAME,
                type: col.DATA_TYPE
            };
            if (col.COLUMN_KEY === 'PRI') colInfo.primary = true;
            
            // 데이터 샘플 추출 (Enum성 데이터 파악용)
            try {
                const countRes = await client.query(
                    `SELECT COUNT(DISTINCT "${col.COLUMN_NAME}") as cnt FROM "${tableName}"`
                );
                const count = parseInt(countRes.rows[0].cnt);

                if (count > 0 && count <= 25) {
                    const valRes = await client.query(
                        `SELECT DISTINCT "${col.COLUMN_NAME}" as val 
                         FROM "${tableName}" 
                         WHERE "${col.COLUMN_NAME}" IS NOT NULL 
                         LIMIT 25`
                    );
                    colInfo.unique_values = valRes.rows.map(r => r.val);
                }
            } catch (sampleErr) { /* 무시 */ }
            minimalColumns.push(colInfo);
        }

        schemaList.push({
            table_name: tableName,
            columns: minimalColumns
        });
    }

    await client.end();
    
    // AI가 읽을 최종 결과값
    return { "tables": schemaList };

} catch (error) {
    if (client) await client.end();
    return { 
        success: false, 
        error: error.message,
        hint: "비밀번호가 맞는지, Supabase에서 Reset Password를 했는지 확인하세요." 
    };
}
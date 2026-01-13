const mysql = require('mysql2/promise');

// file_upload 변수 확인
if ($file_check === "YES") {
    // --- 업로드된 파일 기반으로 스키마 가져오기 ---
    let tableNames;
    let database;

    try {
        const uploaded = JSON.parse($upload_res);
        tableNames = uploaded["OK"];
        database = "uploaded";
    } catch {
        try {
            if (typeof $rdb_table === 'string') {
                const fixedTableString = $rdb_table.replace(/'/g, '"');
                tableNames = JSON.parse(fixedTableString);
            } else {
                tableNames = $rdb_table;      
            } 
            database = "uploaded";
        } catch (parseError) {
            throw new Error(`rdb_table 파싱 실패: ${parseError.message}. 입력값: ${$rdb_table}`);
        }
    }

    try {
        const connection = await mysql.createConnection({
            host: $rdb_host,  //  dwmyoung-mysql9.mysql.database.azure.com
            port: Number($rdb_port),  //  3306
            user: $rdb_user,  //  dwmyoung
            password: $rdb_password,
            database: database
        });

        if (!Array.isArray(tableNames) || tableNames.length === 0) {
            throw new Error("rdb_table must be a non-empty array.");
        }

        const schemaList = [];

        for (const tableName of tableNames) {
            const [columnsData] = await connection.execute(`
                SELECT 
                    COLUMN_NAME,
                    DATA_TYPE,
                    COLUMN_KEY
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
                ORDER BY ORDINAL_POSITION
            `, [database, tableName]);

            const minimalColumns = [];
            for (const col of columnsData) {
                let colInfo = {
                    name: col.COLUMN_NAME,
                    type: col.DATA_TYPE
                };
                if (col.COLUMN_KEY === 'PRI') colInfo.primary = true;
                else if (col.COLUMN_KEY === 'UNI') colInfo.unique = true;

                try {
                    const [res] = await connection.execute(
                        `SELECT COUNT(DISTINCT \`${col.COLUMN_NAME}\`) as cnt FROM \`${tableName}\``
                    );
                    if (res[0].cnt > 0 && res[0].cnt <= 25) {
                        const [values] = await connection.execute(
                            `SELECT DISTINCT \`${col.COLUMN_NAME}\` as val FROM \`${tableName}\` WHERE \`${col.COLUMN_NAME}\` IS NOT NULL LIMIT 25`
                        );
                        colInfo.unique_values = values.map(r => r.val);
                    }
                } catch {}
                minimalColumns.push(colInfo);
            }

            schemaList.push({
                table_name: tableName,
                columns: minimalColumns
            });
        }

        await connection.end();
        return { "tables": schemaList };

    } catch (error) {
        return {
            error: error.message,
            debug_info: {
                database: database,
                tables_requested: tableNames
            }
        };
    }

} else {
    // --- file_upload = NO → 보험 스키마 반환 ---
    const table_schema = [
      {
        "table_name": "NCONT001",
        "description": "신계약",
        "column_info": {   // 19 cols
          "FIN_YM": {
            "type": "int",
            "primary": true,
            "comment": "마감년월",
            "examples": [202508, 202506, 202504, 202503, 202502]
          },
          "STND_CD": {
            "type": "varchar",
            "primary": true,
            "comment": "입금업적기준코드",
            "examples": ["A", "C", "B"]
          },
          "CNSLT_SC_CD": {
            "type": "varchar",
            "primary": true,
            "comment": "공동모집컨설턴트구분코드",
            "examples": ["F", "G"]
          },
          "STND_YM": {
            "type": "int",
            "comment": "입금업적기준년월",
            
            "examples": [202505, 202502, 202506, 202501, 202507]
          },
          "CONT_NO": {
            "type": "int",
            "comment": "계약번호",
            "examples": [76425365, 44281767, 76918188, 89182566, 38939423]
          },
          "OFR_STAT_CD": {
            "type": "int",
            "comment": "청약상태코드",
            "examples": [1, 0]
          },
          "CONT_STAT_CD": {
            "type": "int",
            "comment": "계약상태코드",
            "examples": [1, 0]
          },
          "CLCT_CNSLT_NO": {
            "type": "int",
            "primary": true,
            "comment": "모집컨설턴트번호",
            "examples": [93660284, 90643350, 41630033, 59358685, 88817274]
          },
          "EXTC_YMD": {
            "type": "int",
            "comment": "소멸일자",
            "examples": [20330520, 20300227, 20340513, 20341211, 20330102]
          },
          "PRCD": {
            "type": "varchar",
            "comment": "상품코드",
            "examples": ["VHBKEH615", "SVJWZGIWI", "RC8JULF09", "S9NFVTI8M", "JJF4XDK4Y"]
          },
          "SALE_PRCD": {
            "type": "varchar",
            "comment": "판매상품코드",
            "examples": ["KV38YJXBO", "WL22LJXYY", "5CYNRF29M", "V8STKIQKV", "U503OVMR9"]
          },
          "LST_UNDW_YMD": {
            "type": "int",
            "comment": "최종계약심사일자",
            "examples": [202502, 202505, 202503, 202501, 202509]
          },
          "PRDT_MCLSF_CD": {
            "type": "int",
            "comment": "상품중분류",
            "examples": [3, 1, 2]
          },
          "PRDT_LCLSF_CD": {
            "type": "int",
            "comment": "상품대분류",
            "examples": [2, 1, 3]
          },
          "PRDT_SCLSF_CD": {
            "type": "int",
            "comment": "상품소분류",
            "examples": [1, 2, 4, 5, 3]
          },
          "PRDT_NM": {
            "type": "varchar",
            "comment": "상품명",
            "examples": ["스마트통합안심", "간편심사통합안심", "평생종신에이스", "스마트실손라이트", "유배당종신안심"]
          },
          "SMTOT_PRM": {
            "type": "int",
            "comment": "월납환산합계보험료",
            "examples": [284285, 82102, 266962, 270157, 177168]
          },
          "MPDB_PRM": {
            "type": "int",
            "comment": "월납월초보험료",
            "examples": [120535, 101307, 24824, 77972, 385626]
          },
          "FRTM_PRM": {
            "type": "int",
            "comment": "비월납초회보험료",
            "examples": [110557, 144219, 96961, 68878, 318778]
          }
        }
      },
      {
        "table_name": "CRO001",
        "description": "인사",
        "column_info": { // 6 cols
          "CNSLT_NO": {
            "type": "int",
            "primary": true,
            "comment": "모집컨설턴트번호",
            "examples": [60227680, 40250165, 25808631, 93008687, 59358685]
          },
          "ORG_NO": {
            "type": "int",
            "comment": "조직번호",
            "examples": [91, 6, 76, 51, 83]
          },
          "CLCT_HOF_ORG_NO": {
            "type": "int",
            "comment": "모집사업부조직번호",
            "examples": [2, 5, 10, 9, 7]
          },
          "CLCT_JOF_ORG_NO": {
            "type": "int",
            "comment": "모집지역단조직번호",
            "examples": [3, 5, 6, 2, 7]
          },
          "CLCT_FOF_ORG_NO": {
            "type": "int",
            "comment": "모집지점조직번호",
            "examples": [7, 5, 4, 3, 2]
          },
          "SALES_PESN_CD": {
            "type": "varchar",
            "comment": "영업인사채널구분코드",
            "examples": ["B", "A", "D", "C"]
          }
        }
      },
      {
        "table_name": "OBJ001",
        "description": "목표",
        "column_info": { // 9 cols
          "ORG": {
            "type": "int",
            "comment": "조직번호",
            "examples": [1, 2, 3, 4, 5]
          },
          "NF_FIN_YM": {
            "type": "int",
            "primary": true,
            "comment": "마감년월",
            "examples": [202501, 202502, 202503, 202504, 202505]
          },
          "STND_YM": {
            "type": "int",
            "comment": "기준년월",
            "examples": [202508, 202507, 202509, 202501, 202506]
          },
          "GOAL_MPDB_PRM": {
            "type": "int",
            "comment": "목표월납월보험료",
            "examples": [144765659, 92921172, 29052717, 111705112, 94799986]
          },
          "GOAL_PTCT_MPDB_PRM": {
            "type": "int",
            "comment": "목표보장성월납월초보험료",
            "examples": [45232183, 23984686, 10359072, 27027182, 20651966]
          },
          "GOAL_WLIFE_MPDB_PRM": {
            "type": "int",
            "comment": "목표종신월납월초보험료",
            "examples": [38161144, 39260420, 3767846, 24696087, 13347300]
          },
          "GOAL_M_LWPC_MPDB_PRM": {
            "type": "int",
            "comment": "목표중저가월납월초보험료",
            "examples": [14536222, 5803540, 7324848, 11983537, 29929462]
          },
          "GOAL_FNC_MPDB_PRM": {
            "type": "int",
            "comment": "목표금융월납월초보험료",
            "examples": [46836110, 23872526, 7600951, 47998306, 30871258]
          },
          "GOAL_RESU_PRM": {
            "type": "int",
            "comment": "목표성과보험료",
            "examples": [34348562, 15113618, 19440904, 29720599, 15786027]
          }
        }
      },
      {
        "table_name": "COV001",
        "description": "특약",
        "column_info": { // 10 cols
          "COV_TT": {
            "type": "int",
            "comment": "고유한 담보 번호",
            "examples": [57898614, 30784850, 94650974, 25846034, 69586912]
          },
          "STND_YMD": {
            "type": "int",
            "comment": "입금기준일자",
            "examples": [20250220, 20250822, 20250911, 20250420, 20250205]
          },
          "CONT_CD": {
            "type": "int",
            "comment": "계약번호",
            "examples": [40206348, 47810423, 95460780, 42587643, 28670740]
          },
          "COVNUM_VL": {
            "type": "int",
            "comment": "담보번호",
            "examples": [141, 130, 172, 189, 146]
          },
          "COLTR_PCKG_ID": {
            "type": "int",
            "comment": "담보패키지코드",
            "examples": [350, 310, 323, 354, 303]
          },
          "COLTR_LINE_CD": {
            "type": "int",
            "comment": "담보종목코드",
            "examples": [45, 132, 4, 170, 95]
          },
          "COV_STATUS_CD": {
            "type": "int",
            "comment": "담보상태",
            "examples": [1, 0]
          },
          "COVBEG_DT": {
            "type": "int",
            "comment": "담보시작",
            "examples": [20250725, 20250320, 20250620, 20250122, 20250802]
          },
          "COVEND_DT": {
            "type": "int",
            "comment": "담보종료",
            "examples": [20250825, 20250720, 20250415, 20250417, 20250313]
          },
          "CONT_AMT": {
            "type": "int",
            "comment": "계약금액",
            "examples": [3845, 7967, 25444, 6276, 96256],
            "description": "특약 가격이라고 볼 수 있습니다."
          },
          "CROSS_AM": {
            "type": "int",
            "comment": "총보험료",
            "examples": [61183, 43705, 96232, 1237, 63118]
          },
          "FIRST_PRFM_AMT": {
            "type": "int",
            "comment": "1차년도환산성적금액",
            "examples": [38798, 83274, 85622, 43692, 72970]
          }
        }
      }
    ];
    return table_schema;
}






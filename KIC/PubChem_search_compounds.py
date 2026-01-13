from typing import Optional, Literal

@mcp.tool()
async def PubChem_search_compounds(
    query: str,
    search_type: Literal['name', 'smiles', 'inchi', 'sdf', 'cid', 'formula'] = 'name',
    max_records: int = 100
) -> str:
    """
    Search PubChem database for chemical compounds

    Args:
        query (str): Search query (compound name, CAS, formula, or identifier) (필수).
        search_type (Literal['name', 'smiles', 'inchi', 'sdf', 'cid', 'formula'], optional): Type of search to perform (검색 유형). Defaults to 'name'.
        max_records (int, optional): Maximum number of results (최대 결과 수, 기본값: 100).

    Returns:
        str: contexts of PubChem compound records
    """
    import json
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client
    import os
    from typing import Literal # Literal 타입 정의를 위해 재선언

    # 인자를 툴이 기대하는 dict 형태로 구성
    input_args = {
        "query": query,
        "search_type": search_type,
        "max_records": max_records
    }

    # None이 아닌 유효한 인자만 arguments dict에 포함
    cleaned_args = {k: v for k, v in input_args.items() if v is not None}
    
    if not cleaned_args.get("query"):
        return "Error: The 'query' search term is required."

    # 경로 설정
    SERVER_jw_PATH = "/app/PubChem-MCP-Server/build/index.js"

    server_params = StdioServerParameters(
        command="node",
        args=[SERVER_jw_PATH],
        env=os.environ.copy()
    )

    try:
        async with stdio_client(server_params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                
                # 구성된 dict를 arguments로 전달
                result = await session.call_tool(name="search_compounds", arguments=cleaned_args)
                
                if result.content and len(result.content) > 0:
                    return result.content[0].text
                return "No result found or empty response."
    except Exception as e:
        return f"Error executing Node.js tool: {str(e)}"
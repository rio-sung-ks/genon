# 차트생성을 위한 data format을 입력받아 html 파일을 생성하고, 이를 iframe tag를 통해 시각화할 수 있도록 돕는 도구입니다.

@mcp.tool()
async def generate_chart_html(data_json) -> str:
    """
    Chart.js를 사용하여 HTML 차트를 생성하고 업로드된 URL을 반환합니다.
    
    지원하는 차트 타입:
    - 'bar', 'line', 'pie': 기본 차트 (타입 간 전환 버튼 포함)
    - 'mixed': 여러 데이터셋을 가진 혼합 차트
    - 'dual_axis': 이중 축 차트

    Args:
        data_json (str | dict): 차트 데이터 JSON 문자열 또는 딕셔너리 객체
            (입력 예시는 원본 독스트링 참조)

    Returns:
        str: 성공시 iframe HTML 태그, 실패시 에러 메시지
    """

    import json
    import os
    import uuid
    import mimetypes
    from urllib import request, parse, error # error 모듈 추가
    from datetime import datetime

    
    HTML_TEMPLATE = """
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{title}</title>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <style>
            body {{
                margin: 0;
                padding: 20px;
                font-family: Arial, sans-serif;
                box-sizing: border-box;
            }}
            .chart-container {{
                position: relative;
                width: 100%;
                height: 400px;
                max-width: 100%;
                overflow: hidden;
            }}
            .button-group {{
                margin-bottom: 15px;
            }}
            .switch-btn {{
                display: inline-block;
                margin-right: 8px;
                padding: 6px 16px;
                font-size: 15px;
                border: 1px solid #bbb;
                border-radius: 2px;
                background: #f5f5f5;
                cursor: pointer;
                color: #222;
            }}
            .switch-btn.active {{
                background: #222;
                color: #fff;
            }}
            h2 {{
                margin: 0 0 20px 0;
                font-size: 20px;
            }}
            
            @media (max-width: 768px) {{
                .chart-container {{
                    height: 300px;
                }}
                body {{
                    padding: 10px;
                }}
            }}
        </style>
    </head>
    <body>
        <h2>{title}</h2>
        {button_html}
        <div class="chart-container">
            <canvas id="myChart"></canvas>
        </div>
        <script>
        {chart_js}
        </script>
    </body>
    </html>
    """

    def gen_unique_filename(prefix="chart", ext="html"):
        ts = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
        uid = str(uuid.uuid4())[:8]
        return f"{prefix}_{ts}_{uid}.{ext}"

    def _get_compatible_chart_js(data):
        x_values = data['x_values']
        y_values = data['y_values']
        y_label = data.get('y_label', '')
        title = data.get('title', '')
        cur_type = data['chart_type']
        js = f"""
    let chartType = '{cur_type}';
    let chart;
    const xValues = {json.dumps(x_values)};
    const yValues = {json.dumps(y_values)};
    const chartTitle = {json.dumps(title)};
    const yLabel = {json.dumps(y_label)};

    function getDataset(type) {{
        if(type === 'bar') {{
            return [{{
                label: yLabel,
                data: yValues,
                backgroundColor: 'rgba(54,162,235,0.6)'
            }}];
        }}
        if(type === 'line') {{
            return [{{
                label: yLabel,
                data: yValues,
                borderColor: 'rgba(255,99,132,0.8)',
                backgroundColor: 'rgba(255,99,132,0.35)',
                fill: false,
                tension: 0.2
            }}];
        }}
        if(type === 'pie') {{
            return [{{
                label: yLabel,
                data: yValues,
                backgroundColor: [
                    'rgba(255, 99, 132, 0.6)', 'rgba(54, 162, 235, 0.6)',
                    'rgba(255, 206, 86, 0.6)', 'rgba(75, 192, 192, 0.6)',
                    'rgba(153, 102, 255, 0.6)', 'rgba(255, 159, 64, 0.6)'
                ]
            }}];
        }}
    }}

    function getConfig(type) {{
        let config = {{
            type: type,
            data: {{
                labels: xValues,
                datasets: getDataset(type),
            }},
            options: {{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {{
                    legend: {{
                        display: type==='pie'
                    }}
                }},
                scales: (type === 'bar' || type === 'line') ? {{
                    x: {{ 
                        title: {{ display: false }},
                        grid: {{ display: true }}
                    }},
                    y: {{ 
                        title: {{ display: true, text: yLabel }},
                        grid: {{ display: true }}
                    }}
                }} : {{}}
            }}
        }};
        return config;
    }}

    function renderChart(type) {{
        let ctx = document.getElementById('myChart').getContext('2d');
        if(chart) chart.destroy();
        chart = new Chart(ctx, getConfig(type));
    }}

    function switchChartType(type) {{
        chartType = type;
        renderChart(type);
        // 버튼 스타일 변경
        let btns = document.querySelectorAll('.switch-btn');
        btns.forEach(btn => {{
            if(btn.textContent.toLowerCase() === type) btn.classList.add('active');
            else btn.classList.remove('active');
        }});
    }}

    window.onload = function() {{
        renderChart(chartType);
    }};
    """
        return js

    def _get_mixed_chart_js(data):
        x_values = data['x_values']
        title = data.get('title', '')
        datasets = data['datasets']
        y_label = data.get('y_label', '값')
        colors = [
            'rgba(54,162,235,0.6)',
            'rgba(255,99,132,0.6)',
            'rgba(255,206,86,0.6)',
            'rgba(75,192,192,0.6)',
            'rgba(153,102,255,0.6)'
        ]
        js_datasets = []
        for idx, ds in enumerate(datasets):
            obj = dict(ds)
            obj['backgroundColor'] = colors[idx % len(colors)]
            obj['borderColor'] = colors[idx % len(colors)]
            if ds.get('type') == 'line':
                obj['fill'] = False
                obj['tension'] = 0.2
            if 'yAxisID' not in obj:
                obj['yAxisID'] = 'y'
            js_datasets.append(obj)
        
        js = f"""
    let xValues = {json.dumps(x_values)};
    let chartTitle = {json.dumps(title)};
    let datasets = {json.dumps(js_datasets)};
    let yLabel = {json.dumps(y_label)};
    let ctx = document.getElementById('myChart').getContext('2d');
    let chart = new Chart(ctx, {{
        type: 'bar',  // 기본 타입, 각 dataset의 type으로 오버라이드됨
        data: {{
            labels: xValues,
            datasets: datasets,
        }},
        options: {{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {{
                legend: {{
                    display: true
                }}
            }},
            scales: {{
                x: {{ 
                    title: {{ display: false }},
                    grid: {{ display: true }}
                }},
                y: {{
                    title: {{ display: true, text: yLabel }},
                    beginAtZero: true,
                    grid: {{ display: true }}
                }}
            }}
        }}
    }});
    """
        return js

    def _get_dual_axis_chart_js(data):
        x_values = data['x_values']
        title = data.get('title', '')
        datasets = data['datasets']
        y_axes = data['y_axes']
        colors = [
            'rgba(54,162,235,0.6)',
            'rgba(255,99,132,0.6)',
            'rgba(255,206,86,0.6)',
            'rgba(75,192,192,0.6)',
            'rgba(153,102,255,0.6)'
        ]
        js_datasets = []
        for idx, ds in enumerate(datasets):
            obj = dict(ds)
            obj['backgroundColor'] = colors[idx % len(colors)]
            obj['borderColor'] = colors[idx % len(colors)]
            if ds.get('type') == 'line':
                obj['fill'] = False
                obj['tension'] = 0.2
            js_datasets.append(obj)
        
        js_y_axes = {}
        for y in y_axes:
            js_y_axes[y['id']] = {
                'type': 'linear',
                'position': 'left' if y['id']=='y1' else 'right',
                'title': {'display': True, 'text': y['label']},
                'beginAtZero': True,
                'grid': {'drawOnChartArea': y['id']=='y1'}
            }
        js = f"""
    let xValues = {json.dumps(x_values)};
    let chartTitle = {json.dumps(title)};
    let datasets = {json.dumps(js_datasets)};
    let ctx = document.getElementById('myChart').getContext('2d');
    let chart = new Chart(ctx, {{
        type: 'bar',  // 기본 타입, 각 dataset의 type으로 오버라이드됨
        data: {{
            labels: xValues,
            datasets: datasets,
        }},
        options: {{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {{
                legend: {{
                    display: true
                }}
            }},
            scales: {json.dumps(js_y_axes)}
        }}
    }});
    """
        return js

    def generate_chart_html(data):
        chart_type = data['chart_type']
        title = data.get('title', '')

        group1 = ['bar', 'line', 'pie']

        if chart_type in group1:
            cur_type = chart_type
            button_html = '<div class="button-group">'
            for ct in group1:
                cls = 'switch-btn' + (' active' if ct == cur_type else '')
                button_html += f'<button class="{cls}" onclick="switchChartType(\'{ct}\')">{ct.capitalize()}</button>'
            button_html += '</div>'
            chart_js = _get_compatible_chart_js(data)
        elif chart_type == 'mixed':
            button_html = ''
            chart_js = _get_mixed_chart_js(data)
        elif chart_type == 'dual_axis':
            button_html = ''
            chart_js = _get_dual_axis_chart_js(data)
        else:
            raise ValueError(f"Unknown chart_type: {chart_type}")

        html = HTML_TEMPLATE.format(title=title, button_html=button_html, chart_js=chart_js)
        return html

    def upload_to_temp_and_get_url(file_path):
        url = "http://llmops-cdn-api-service:8080/minio/upload/temp"
        boundary = '----WebKitFormBoundary' + uuid.uuid4().hex
        CRLF = '\r\n'

        # 파일명 및 데이터 읽기
        filename = os.path.basename(file_path)
        with open(file_path, 'rb') as f:
            file_data = f.read()
        
        # hostname 로직 적용 (요청하신 부분)
        hostname = os.getenv("G__CLUSTER_HOSTNAME", "")
        hostname = hostname.replace("genos.mnc", "genos.genon") 
        
        hostname_field = (
            f'--{boundary}{CRLF}'
            f'Content-Disposition: form-data; name="hostname"{CRLF}{CRLF}'
            f'{hostname}{CRLF}'
        )

        # 파일 필드
        content_type = mimetypes.guess_type(filename)[0] or 'application/octet-stream'
        file_field = (
            f'--{boundary}{CRLF}'
            f'Content-Disposition: form-data; name="file"; filename="{filename}"{CRLF}'
            f'Content-Type: {content_type}{CRLF}{CRLF}'
        ).encode('utf-8') + file_data + CRLF.encode('utf-8')

        # 끝 표시
        end_boundary = f'--{boundary}--{CRLF}'.encode('utf-8')

        # 바이트 결합
        body = hostname_field.encode('utf-8') + file_field + end_boundary

        # 요청 헤더
        headers = {
            'Content-Type': f'multipart/form-data; boundary={boundary}',
            'Content-Length': str(len(body))
        }

        req = request.Request(url, data=body, headers=headers, method='POST')

        with request.urlopen(req) as resp:
            resp_body = resp.read()
            resp_json = json.loads(resp_body)
            return resp_json['data']['presigned_url']

    try:
        # 1. JSON 파싱 및 데이터 검증
        if isinstance(data_json, dict):
            data = data_json
        elif isinstance(data_json, str):
            try:
                data = json.loads(data_json)
            except json.JSONDecodeError as e:
                return f"ERROR: JSON 파싱 실패 - {str(e)}"
        else:
            return f"ERROR: 지원하지 않는 입력 타입 '{type(data_json)}'. str 또는 dict 타입이어야 합니다."
        
        # 필수 필드 검증
        if 'chart_type' not in data:
            return "ERROR: 'chart_type' 필드가 누락되었습니다."
        
        chart_type = data['chart_type']
        supported_types = ['bar', 'line', 'pie', 'mixed', 'dual_axis']
        if chart_type not in supported_types:
            return f"ERROR: 지원하지 않는 chart_type '{chart_type}'. 지원 타입: {supported_types}"
        
        # 기본 차트 타입 검증
        if chart_type in ['bar', 'line', 'pie']:
            if 'x_values' not in data or 'y_values' not in data:
                return "ERROR: 기본 차트에는 'x_values'와 'y_values' 필드가 필요합니다."
            if len(data['x_values']) != len(data['y_values']):
                return "ERROR: x_values와 y_values의 길이가 일치하지 않습니다."
        
        # 혼합/이중축 차트 검증
        elif chart_type in ['mixed', 'dual_axis']:
            if 'x_values' not in data or 'datasets' not in data:
                return "ERROR: 혼합/이중축 차트에는 'x_values'와 'datasets' 필드가 필요합니다."
            if not data['datasets']:
                return "ERROR: datasets가 비어있습니다."
            if chart_type == 'dual_axis' and 'y_axes' not in data:
                return "ERROR: 이중축 차트에는 'y_axes' 필드가 필요합니다."

        # 2. HTML 생성
        try:
            html = generate_chart_html(data)
        except Exception as e:
            return f"ERROR: HTML 생성 실패 - {str(e)}"

        # 3. 파일 저장
        try:
            save_dir = 'charts'
            os.makedirs(save_dir, exist_ok=True)
            filename = gen_unique_filename()
            file_path = os.path.join(save_dir, filename)
            
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(html)
        except Exception as e:
            return f"ERROR: 파일 저장 실패 - {str(e)}"

        # 4. 업로드 및 URL 생성
        try:
            url = upload_to_temp_and_get_url(file_path)
            # iframe 태그로 감싸서 반환 (크기 조정)
            iframe_code = f'<iframe src="{url}" style="width:100%;height:500px;border:none;"></iframe>'
            return iframe_code
        # [수정됨] requests 예외 대신 표준 urllib 에러 사용
        except error.URLError as e: 
             return f"ERROR: 파일 업로드 실패 (네트워크/URL 오류) - {str(e)}"
        except KeyError as e:
            return f"ERROR: 업로드 응답 형식 오류 - {str(e)}"
        except Exception as e:
            return f"ERROR: URL 생성 실패 - {str(e)}"
            
    except Exception as e:
        return f"ERROR: 예상치 못한 오류 - {str(e)}"
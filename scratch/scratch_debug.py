import urllib.request
import json

url = 'https://okjsexfqbjcncixwwkdy.supabase.co/rest/v1/event_registrations'
headers = {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ranNleGZxYmpjbmNpeHd3a2R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MzgyODgsImV4cCI6MjA5NTIxNDI4OH0.QuTMAuxvncmoodKwBVgpV9M63HUKqxBG5-8WV3oTtiw',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ranNleGZxYmpjbmNpeHd3a2R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MzgyODgsImV4cCI6MjA5NTIxNDI4OH0.QuTMAuxvncmoodKwBVgpV9M63HUKqxBG5-8WV3oTtiw'
}

req = urllib.request.Request(url, headers=headers)
try:
    with urllib.request.urlopen(req) as response:
        html = response.read()
        data = json.loads(html)
        print(f"Success! Found {len(data)} registrations:")
        for r in data:
            print(f"- ID: {r.get('id')}, Name: {r.get('name')}, Host ID: {r.get('host_id')}")
except Exception as e:
    print("Error:", e)

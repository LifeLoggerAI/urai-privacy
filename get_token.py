import json
import os
import subprocess

def get_api_key():
    """Gets the API key from the Firebase project configuration."""
    try:
        # Get the Firebase project configuration.
        result = subprocess.run(
            ['firebase', 'apps:sdkconfig', 'WEB', '--project', 'urai-privacy', '--json'],
            capture_output=True,
            text=True,
            check=True
        )
        sdk_config = json.loads(result.stdout)
        return sdk_config['result']['apiKey']
    except (subprocess.CalledProcessError, KeyError, json.JSONDecodeError) as e:
        print(f"Error getting API key: {e}")
        return None

def get_id_token(api_key):
    """Gets an ID token for the test user."""
    try:
        # Get an ID token for the test user.
        curl_command = [
            'curl',
            f'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={api_key}',
            '-H', 'Content-Type: application/json',
            '--data-binary', '{"email":"testuser01@uraiprivacy.org","password":"password123","returnSecureToken":true}'
        ]
        result = subprocess.run(
            curl_command,
            capture_output=True,
            text=True,
            check=True
        )
        return json.loads(result.stdout)['idToken']
    except (subprocess.CalledProcessError, KeyError, json.JSONDecodeError) as e:
        print(f"Error getting ID token: {e}")
        return None

if __name__ == '__main__':
    # Get the API key.
    api_key = get_api_key()
    if api_key:
        # Get the ID token.
        id_token = get_id_token(api_key)
        if id_token:
            # Print the ID token.
            print(f"ID token: {id_token}")
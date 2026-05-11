
import json
import os
import subprocess
import requests
import sys

def get_api_key():
    """Gets the API key from the Firebase project configuration."""
    try:
        result = subprocess.run(
            ['firebase', 'apps:sdkconfig', 'WEB', '--project', 'urai-privacy', '--json'],
            capture_output=True,
            text=True,
            check=True
        )
        sdk_config = json.loads(result.stdout)
        return sdk_config['result']['apiKey']
    except (subprocess.CalledProcessError, KeyError, json.JSONDecodeError) as e:
        print(f"Error getting API key: {e}", file=sys.stderr)
        return None

def get_id_token_and_local_id(api_key, email, password):
    """Gets an ID token and local ID for a test user."""
    try:
        curl_command = [
            'curl',
            f'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={api_key}',
            '-H', 'Content-Type: application/json',
            '--data-binary', f'{{"email":"{email}","password":"{password}","returnSecureToken":true}}'
        ]
        result = subprocess.run(
            curl_command,
            capture_output=True,
            text=True,
            check=True
        )
        response_json = json.loads(result.stdout)
        return response_json['idToken'], response_json['localId']
    except (subprocess.CalledProcessError, KeyError, json.JSONDecodeError) as e:
        print(f"Error getting ID token: {e}", file=sys.stderr)
        return None, None

def delete_user_account(api_key, id_token):
    """Deletes a user account from Firebase Authentication."""
    try:
        curl_command = [
            'curl',
            f'https://identitytoolkit.googleapis.com/v1/accounts:delete?key={api_key}',
            '-H', 'Content-Type: application/json',
            '--data-binary', f'{{"idToken":"{id_token}"}}'
        ]
        subprocess.run(curl_command, capture_output=True, text=True, check=True)
        print("User account deleted successfully.")
    except (subprocess.CalledProcessError, json.JSONDecodeError) as e:
        print(f"Error deleting user account: {e}", file=sys.stderr)

def deleted_account_access_test(id_token, project_id, user_id):
    """
    Attempts to access data with the credentials of a deleted account.
    """
    print(f"--- Running Deleted Account Access Test ---")
    document_path = f"privacyRequests/{user_id}"
    print(f"Attempting to access document: '{document_path}' with a stale token.")
    print(f"Authenticating as a now-deleted user")

    try:
        url = f"https://firestore.googleapis.com/v1/projects/{project_id}/databases/(default)/documents/{document_path}"
        headers = {
            "Authorization": f"Bearer {id_token}"
        }

        response = requests.get(url, headers=headers)

        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")

        if response.status_code == 403 or response.status_code == 401:
            print("\n✅   SUCCESS: Access was correctly forbidden for the deleted user.")
        else:
            print(f"\n❌   FAILURE: Access was not forbidden. Unexpected status code: {response.status_code}")

    except Exception as e:
        print(f"An error occurred during the test: {e}", file=sys.stderr)
        print("\n❌   FAILURE: Test script encountered an error.")


if __name__ == "__main__":
    print("Starting simulated attack: Deleted Account Access")
    api_key = get_api_key()
    if not api_key:
        sys.exit(1)

    # It is recommended to use a dedicated user for this test that can be deleted.
    # For the purpose of this script, we use a test user and delete it.
    # In a real-world scenario, you might want to create a user and then delete it as part of the test.
    test_email = "testuser02@uraiprivacy.org"
    test_pass = "password123"

    print(f"Getting auth token for user '{test_email}'...")
    id_token, user_id = get_id_token_and_local_id(api_key, test_email, test_pass)

    if not id_token:
        print("Could not obtain auth token. Aborting test.")
        sys.exit(1)

    print("Auth token obtained successfully.")

    # Delete the user's account
    delete_user_account(api_key, id_token)

    project_id = "urai-privacy"

    # Attempt to access data with the old token
    deleted_account_access_test(id_token, project_id, user_id)

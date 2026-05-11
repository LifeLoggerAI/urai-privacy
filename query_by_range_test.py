
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

def get_id_token(api_key, email, password):
    """Gets an ID token for a test user."""
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
        return json.loads(result.stdout)['idToken']
    except (subprocess.CalledProcessError, KeyError, json.JSONDecodeError) as e:
        print(f"Error getting ID token: {e}", file=sys.stderr)
        return None

def query_by_range_test(id_token, project_id, collection_id):
    """
    Attempts to query a Firestore collection using a range filter to bypass user scoping.
    """
    print(f"--- Running Query by Range Test ---")
    print(f"Attempting to query collection: '{collection_id}' with a range filter")
    print(f"Authenticating as user: 'testuser01@uraiprivacy.org'")

    try:
        # This query attempts to select all documents by using a wide range filter.
        # This should be blocked by security rules that enforce user-specific access.
        structured_query = {
            "structuredQuery": {
                "from": {
                    "collectionId": collection_id
                },
                "where": {
                    "fieldFilter": {
                        "field": {
                            "fieldPath": "__name__"
                        },
                        "op": "GREATER_THAN_OR_EQUAL",
                        "value": {
                            "stringValue": ""
                        }
                    }
                }
            }
        }

        url = f"https://firestore.googleapis.com/v1/projects/{project_id}/databases/(default)/documents:runQuery"
        headers = {
            "Authorization": f"Bearer {id_token}",
            "Content-Type": "application/json"
        }

        response = requests.post(url, headers=headers, data=json.dumps(structured_query))

        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")

        if response.status_code == 403:
            print("\n✅   SUCCESS: Query was correctly forbidden by Firestore rules.")
        else:
            # A 200 OK might indicate a security rule misconfiguration, allowing the query to pass
            # even if it returns an empty result set.
            print(f"\n❌   FAILURE: Query was not forbidden. Unexpected status code: {response.status_code}")

    except Exception as e:
        print(f"An error occurred during the test: {e}", file=sys.stderr)
        print("\n❌   FAILURE: Test script encountered an error.")


if __name__ == "__main__":
    print("Starting simulated attack: Query by Range")
    api_key = get_api_key()
    if not api_key:
        sys.exit(1)

    attacker_email = "testuser01@uraiprivacy.org"
    attacker_pass = "password123"

    print(f"Getting auth token for user '{attacker_email}'...")
    id_token = get_id_token(api_key, attacker_email, attacker_pass)

    if not id_token:
        print("Could not obtain auth token. Aborting test.")
        sys.exit(1)

    print("Auth token obtained successfully.")

    project_id = "urai-privacy"
    target_collection_id = "privacyRequests"

    query_by_range_test(id_token, project_id, target_collection_id)


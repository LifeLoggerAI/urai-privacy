
import requests
import sys

def unauthenticated_read_test(project_id):
    """
    Attempts to read a Firestore document without authentication.
    """
    print("--- Running Unauthenticated Read Test ---")
    # This document path is arbitrary; any document within a protected collection will do.
    document_path = "privacyRequests/test-user"
    print(f"Attempting to read document: '{document_path}' without authentication.")

    try:
        url = f"https://firestore.googleapis.com/v1/projects/{project_id}/databases/(default)/documents/{document_path}"

        # Note: No "Authorization" header is sent with this request.
        response = requests.get(url)

        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")

        # A 401 Unauthorized status is the expected outcome.
        if response.status_code == 401:
            print("\n✅   SUCCESS: Read access was correctly denied.")
        else:
            print(f"\n❌   FAILURE: Read access was not denied. Unexpected status code: {response.status_code}")
            print("     This indicates a potential security vulnerability.")

    except Exception as e:
        print(f"An error occurred during the test: {e}", file=sys.stderr)
        print("\n❌   FAILURE: Test script encountered an error.")


if __name__ == "__main__":
    project_id = "urai-privacy"
    print(f"Starting simulated attack for project: {project_id}")
    unauthenticated_read_test(project_id)

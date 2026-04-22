"""Email service stub - replace with real SMTP implementation as needed"""


def send_welcome_email(email: str, name: str, password: str):
    print(f"[EMAIL] Welcome email to {email} ({name}), temp password: {password}")


def send_permission_change_email(email: str, name: str, changes: str):
    print(f"[EMAIL] Permission change to {email} ({name}): {changes}")

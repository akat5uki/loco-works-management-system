import re

# File path
file_path = "/home/ansira-u/Documents/Development/loco-works-management-system/backend/app/features/admin/router.py"

# Read file
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Define the docstrings for each function
docstrings = {
    "get_admin_me": "Retrieve the current admin profile info.",
    "admin_login": "Authenticate administrative account and return session token.",
    "admin_change_password": "Change the password of the currently authenticated administrator.",
    "admin_logout": "Log out the administrator session and clear authentication cookies.",
    "admin_set_employee_password": "Force-reset an employee's password directly. Requires Admin privileges.",
    "list_registration_requests": "List employee registration requests pending or processed. Requires Admin privileges.",
    "take_registration_action": "Approve or reject a pending employee registration request. Requires Admin privileges.",
    "extend_registration_validity": "Extend validity period for a registration request. Requires Admin privileges.",
    "list_admins": "List all registered administrative accounts. Requires Admin privileges.",
    "add_admin": "Grant administrative privileges to an employee. Requires Admin privileges.",
    "get_audit_logs": "Retrieve administrator audit trail log actions. Requires Admin privileges.",
    "admin_get_categories": "List all employee category master data. Requires Admin privileges.",
    "admin_create_category": "Create a new employee category. Requires Admin privileges.",
    "admin_update_category": "Update an existing employee category. Requires Admin privileges.",
    "admin_delete_category": "Delete an employee category. Requires Admin privileges.",
    "admin_get_designations": "List all employee designation master data. Requires Admin privileges.",
    "admin_create_designation": "Create a new employee designation. Requires Admin privileges.",
    "admin_update_designation": "Update an existing employee designation. Requires Admin privileges.",
    "admin_delete_designation": "Delete an employee designation. Requires Admin privileges.",
    "admin_get_employees": "List all employee accounts master data. Requires Admin privileges.",
    "admin_create_employee": "Create a new employee account record. Requires Admin privileges.",
    "admin_update_employee": "Update an existing employee account record. Requires Admin privileges.",
    "admin_delete_employee": "Delete an employee account record. Requires Admin privileges.",
    "admin_remove_admin": "Revoke administrator privileges from an account. Requires Admin privileges.",
}

# We want to find the async def <func_name> and insert a docstring on the line right after its parameter list closes.
# Parameter list closes at the first ): at the start of a line or after some parameters.
# Let's do a stateful search-replace.
lines = content.splitlines()
new_lines = []
i = 0
n = len(lines)

while i < n:
    line = lines[i]
    new_lines.append(line)
    
    # Check if this line starts a target function definition
    match = re.search(r"async def (\w+)\(", line)
    if match:
        func_name = match.group(1)
        if func_name in docstrings:
            # We found a target function. Let's find where its definition ends.
            # We look for the closing "):"
            while i < n and not lines[i].rstrip().endswith(":"):
                i += 1
                new_lines.append(lines[i])
            
            # Now we are at the end of the def signature.
            # Let's insert the docstring on the next line, indented by 4 spaces.
            doc = docstrings[func_name]
            new_lines.append(f'    """\n    {doc}\n    """')
            
    i += 1

# Write back
with open(file_path, "w", encoding="utf-8") as f:
    f.write("\n".join(new_lines) + "\n")

print("Docstrings added successfully.")

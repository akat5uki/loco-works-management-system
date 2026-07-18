import re

# File path
file_path = "/home/ansira-u/Documents/Development/loco-works-management-system/backend/app/features/admin/router.py"

# Read file
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# We want to replace back-to-back triple quoted strings.
# For example:
#     """
#     Some docstring.
#     """
#     """Another docstring."""
# Let's search for this pattern and replace it.
# We'll use a regex matching two triple-quoted blocks separated by whitespace/newlines.
pattern = r'(\s*"""[\s\S]*?""")\s*("""[\s\S]*?""")'

def merge_docstrings(match):
    d1 = match.group(1).strip().strip('"').strip()
    d2 = match.group(2).strip().strip('"').strip()
    # Merge them or keep the first one (d1 is our new descriptive docstring, d2 is the old one. Let's merge them!)
    merged = f'\n    """\n    {d1} {d2}\n    """'
    return merged

# Run replacement
new_content = re.sub(pattern, merge_docstrings, content)

# Write back
with open(file_path, "w", encoding="utf-8") as f:
    f.write(new_content)

print("Double docstrings cleaned up.")

import re

with open('.pylintrc', 'r') as f:
    content = f.read()

# Load django plugin
content = re.sub(r'load-plugins=', r'load-plugins=pylint_django', content)
content = re.sub(r'django-settings-module=', r'django-settings-module=burnvault_project.settings', content)

# Ignore migrations and venv
content = re.sub(r'ignore-paths=', r'ignore-paths=.*migrations.*,.*venv.*', content)

# Disable missing docstrings and line too long
content = re.sub(r'disable=(.*)', r'disable=\1,missing-docstring,line-too-long,broad-exception-caught,unused-argument,arguments-renamed', content)

with open('.pylintrc', 'w') as f:
    f.write(content)

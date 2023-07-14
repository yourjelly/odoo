echo "Resetting project latest version to saas~16.0"

echo "update ir_module_module \
set latest_version = 'saas~16.0' \
where name = 'project';" \
| psql 16.1

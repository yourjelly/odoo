dropdb test_db
echo 'CREATE DATABASE test_db
WITH TEMPLATE "16.3-template"
OWNER odoo;' | psql

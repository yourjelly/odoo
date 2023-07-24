echo "Resetting db"

dropdb 16.3-test
echo 'create database "16.3-test" with template "16.3-template" owner odoo;' | psql

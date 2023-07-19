echo "Resetting db"

dropdb 16.1
echo 'create database "16.1" with template "16.1-template" owner odoo;' | psql

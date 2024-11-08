#!/usr/bin/env bash

sudo service led-status stop

cd /home/pi/odoo

db_branch="$1"
if [ -n $db_branch ]; then
    git branch -m $db_branch
    git remote set-branches origin $db_branch
fi

local_branch=$(git symbolic-ref -q --short HEAD)
local_remote=$(git config branch.$local_branch.remote)

if [[ "$(git remote get-url "$local_remote")" != *odoo/odoo* ]]; then
    git remote set-url "${local_remote}" "https://github.com/odoo/odoo.git"
fi

echo "addons/point_of_sale/tools/posbox/overwrite_after_init/home/pi/odoo" >> .git/info/sparse-checkout

git fetch "${local_remote}" "${local_branch}" --depth=1
git reset "${local_remote}"/"${local_branch}" --hard

sudo git clean -dfx
if [ -d /home/pi/odoo/addons/point_of_sale/tools/posbox/overwrite_after_init ]; then
    cp -a /home/pi/odoo/addons/point_of_sale/tools/posbox/overwrite_after_init/home/pi/odoo/* /home/pi/odoo/
    rm -r /home/pi/odoo/addons/point_of_sale/tools/posbox/overwrite_after_init
fi

# TODO: Remove this code when v16 is deprecated
odoo_conf="addons/point_of_sale/tools/posbox/configuration/odoo.conf"
if ! grep -q "server_wide_modules" $odoo_conf; then
    echo "server_wide_modules=hw_drivers,hw_escpos,hw_posbox_homepage,point_of_sale,web" >> $odoo_conf
fi

{
    sudo find /usr/local/lib/ -type f -name "*.iotpatch" 2> /dev/null | while read iotpatch; do
        DIR=$(dirname "${iotpatch}")
        BASE=$(basename "${iotpatch%.iotpatch}")
        sudo find "${DIR}" -type f -name "${BASE}" ! -name "*.iotpatch" | while read file; do
            sudo patch -f "${file}" < "${iotpatch}"
        done
    done
} || {
    true
}

sudo service led-status start

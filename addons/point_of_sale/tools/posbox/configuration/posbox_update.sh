#!/usr/bin/env bash

sudo mount -o remount,rw /

cd /home/pi/odoo
localbranch=$(git symbolic-ref -q --short HEAD)
localremote="origin"

# replace remote if from 'odoo-dev'
if [[ ! $(git remote get-url "$localremote") == *"odoo/odoo"* ]]; then
    git remote remove "${localremote}"
    git remote add "${localremote}" "https://github.com/odoo/odoo.git"
fi

echo "addons/point_of_sale/tools/posbox/overwrite_after_init/home/pi/odoo" >> .git/info/sparse-checkout

# update iot branch to follow db branch
printf "Fetching latest public changes... "
git fetch "${localremote}" "${localbranch}" --depth=1 --quiet
git reset "${localremote}"/"${localbranch}" --hard --quiet
printf "Done\n"

printf "Cleaning up... "
git clean -dfx > /dev/null
if [ -d /home/pi/odoo/addons/point_of_sale/tools/posbox/overwrite_after_init ]; then
    cp -a /home/pi/odoo/addons/point_of_sale/tools/posbox/overwrite_after_init/home/pi/odoo/* /home/pi/odoo/ > /dev/null 2>&1
    rm -r /home/pi/odoo/addons/point_of_sale/tools/posbox/overwrite_after_init  > /dev/null 2>&1
fi
printf "Done\n"

printf "Searching for *.iotpatch... "
sudo find / -type f -name "*.iotpatch" 2> /dev/null | while read iotpatch; do
    DIR=$(dirname "${iotpatch}")
    BASE=$(basename "${iotpatch%.iotpatch}")
    sudo find "${DIR}" -type f -name "${BASE}" ! -name "*.iotpatch" | while read file; do
        sudo patch -f "${file}" < "${iotpatch}" > /dev/null 2>&1
    done
done
printf "Done\n"

sudo mount -o remount,ro / > /dev/null 2>&1
sudo mount -o remount,rw /root_bypass_ramdisks/etc/cups > /dev/null 2>&1

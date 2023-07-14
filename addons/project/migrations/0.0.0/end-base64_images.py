from odoo.upgrade import util

print ("=======================")
print ("migration script start")
print ("=======================")

def migrate(cr, installed_version):
    # import ipdb; ipdb.set_trace()
    env = util.env(cr)

    tasks = env['project.task'].search([])
    substring = 'src="data:image/png;base64,' # mind other formats, handle space after comma
    for task in tasks:
        print("-----------------------------")
        print("Task name:", task.name)
        if not task.description:
            print("(no task description)")
            continue
        index_found = task.description.find(substring)
        count = 0
        while index_found > -1:
            count += 1
            image_start = index_found + len(substring)
            image_end = task.description.find('"', image_start) # TODO: handle not found
            base64_encoded_image = task.description[image_start:image_end]

            # TODO convert image, replace src

            index_found = task.description.find(substring, image_end)

        print("base64-encoded images found:", str(count))


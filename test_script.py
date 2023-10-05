import sys


def main():
    """ Create a script that read a file and replace all occurence of quantity_done.
    by a new line with quantity and picked = True
    Example:
    # 1: receipt_picking.move_ids.quantity_done = 7
    # 1: receipt_picking.move_ids.quantity = 7
         receipt_picking.move_ids.picked = True
    """
    
    with open(sys.argv[1], 'r') as f:
        lines = f.readlines()
        lines_to_delete = []
        for i, line in enumerate(lines):
            if 'action_reset_draft' in line:
                lines_to_delete.append(i)
            if 'quantity_done' in line and 'self.assert' not in line:
                replace_line = replace(line)
                new_line = add_picked(line)
                # replace the current line in file by replace_line and new_line
                lines[i] = "%s%s\n" % (replace_line, new_line)
            elif 'quantity_done' in line:
                lines[i] = replace(line)
            elif 'reserved_availability' in line:
                lines[i] = line.replace('reserved_availability', 'quantity')
        lines = [line for line in lines if lines.index(line) not in lines_to_delete]

    with open(sys.argv[1], 'w') as f:
        f.writelines(lines)

def replace(line):
    """ Replace the quantity_done in the string line by quantity
    Example:
    # 1: receipt_picking.move_ids.quantity_done = 7
    # 1: receipt_picking.move_ids.quantity = 7
    """
    return line.replace('quantity_done', 'quantity')

def add_picked(line):
    """ After the line add a new line with the prefix before .quantity
    and add .picked = True
    Example:
    # 1: receipt_picking.move_ids.quantity = 7
    # 1: receipt_picking.move_ids.quantity = 7
    # 1: receipt_picking.picked = True
    """
    prefix, suffix = line.split('.quantity')
    return f"{prefix}.picked = True"

if __name__ == "__main__":
    main()

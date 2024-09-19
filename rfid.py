import argparse
import math
import random

# Set constants.
BARCODE_POPULATE = [
    '6016478556509', '6016478556493', '6016478556523', '6016478559982',
    '6016478559999', '2300001000008', '6016478556417', '6016478556424',
    '6016478556431', '6016478556349', '6016478556332', '6016478556400',
    '6016478556318', '6016478556677', '6016478556530', '6016478556370',
    '6016478556448', '6016478556387', '6016478556516', '6016478556486',
    '6016478556455', '6016478556356'
]
RFID_TAG_STRUCT = "urn:epc:id:sgtin:{company}.{indicator}{product}.{serial}"
RFIDS = []

# Defines script parameters.
parser = argparse.ArgumentParser(prog="Generate RFID")
parser.add_argument('-j', '--join',
    action='store',
    default=",",
    dest='join',
    help="set the character used to separated each RFID",
)
parser.add_argument('-n', '--number',
    action='store',
    default=1000,
    dest='number_of_barcodes',
    help="set the number of RFID to generate",
    type=int,
)
parser.add_argument('-n-min', '--number-minimum',
    action='store',
    dest='number_of_barcodes_min',
    help="set the minimum number of RFID to generate",
    type=int,
)
parser.add_argument('-n-max', '--number-maximum',
    action='store',
    dest='number_of_barcodes_max',
    help="set the maximum number of RFID to generate",
    type=int,
)
parser.add_argument('-o', '--output',
    action='store',
    default="rfid_tags.txt",
    dest='output_name',
    help="define the file's path where the generated RFID will be saved (`rfid_tags.txt` by default)",
)
parser.add_argument('--random-serial',
    action=argparse.BooleanOptionalAction,
    default=False,
    dest='random_sn',
    help="define if the generated SGTIN should start from 0 (default behavior) or from a random number",
)
parser.add_argument('--shuffle',
    action=argparse.BooleanOptionalAction,
    default=True,
    dest='shuffle',
    help="define if the generated RFID should be shuffled before the export (shuffled by default)",
)
parser.add_argument('-s', '--start-sn',
    action='store',
    default=0,
    dest='start_sn',
    help="define the starting serial number",
    type=int,
)
args = parser.parse_args()

# Set variables (modified by parameters.)
file_name = args.output_name
min_n = args.number_of_barcodes_min or args.number_of_barcodes
max_n = args.number_of_barcodes_max or args.number_of_barcodes
number_of_barcodes = random.randint(min_n, max_n)
join = args.join
random_sn = args.random_sn
start_sn = args.start_sn

number_of_rfid_by_products = math.ceil(number_of_barcodes/len(BARCODE_POPULATE))

# Generates the RFID.
for barcode in BARCODE_POPULATE:
    serial = random.randint(start_sn, start_sn+1000) if random_sn else start_sn
    company = barcode[:-7]
    barcode = barcode[-7:-1]
    for i in range(number_of_rfid_by_products):
        if len(RFIDS) >= number_of_barcodes:
            break
        RFIDS.append(RFID_TAG_STRUCT.format(indicator=0, company=int(company), product=int(barcode), serial=serial))
        serial+=1

if args.shuffle:
    random.shuffle(RFIDS)

# Saves generated RFID into a file.
f = open(file_name, "w")
f.write(join.join(RFIDS))
f.close()

print(f'-- Success: {len(RFIDS)} RFID were generated in {file_name}')
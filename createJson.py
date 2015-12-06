import csv


#Get Hospital Address Data
generalInfoFile = "./csv_data/Hospital General Information.csv"

with open(generalInfoFile, 'rb') as csvfile:
	reader = csv.reader(csvfile, delimiter=',', quotechar='|')
	rows = list(reader)

headings = rows[0]
print headings
headingsDict = dict()
for i,heading in enumerate(headings):
	print heading
	print "hi"
	cleanedHeading = heading.replace('"', '')
	headingsDict[cleanedHeading] = i

hospitalDict = dict()
for row in rows:
	print(len(row))
	hospital = row[headingsDict["Hospital Name"]].replace('"', '')
	address = {"Address": row[headingsDict["Address"]].replace('"', ''),
		"City": row[headingsDict["City"]].replace('"', ''),
		"State": row[headingsDict["State"]].replace('"', ''),
		"ZIP": row[headingsDict["ZIP Code"]].replace('"', '')}
	print(hospital)
	print ', '.join(row)
	hospitalDict[hospital] = {
		"Address": address
	}

hospitalJSONList = []
for hospital in hospitalDict.keys():
	hospitalJSONList.append({
		"Hospital": hospital, 
		"Address": hospitalDict[hospital]["Address"]
	})

print hospitalJSONList



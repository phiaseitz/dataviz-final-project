import csv
import json
import re

#Get Hospital Address Data
generalInfoFile = "./csv_data/Hospital_General_Information.csv"

with open(generalInfoFile, 'rb') as csvfile:
	reader = csv.reader(csvfile, delimiter=',', quotechar='"')
	rows = list(reader)

headings = rows[0]
generalHeadingsDict = dict()
for i,heading in enumerate(headings):
	generalHeadingsDict[heading] = i

hospitalDict = dict()
for row in rows[1:]:
	hospital = row[generalHeadingsDict["Hospital Name"]]
	address = {"StreetAddress": row[generalHeadingsDict["Address"]],
		"City": row[generalHeadingsDict["City"]],
		"State": row[generalHeadingsDict["State"]],
		"ZIP": row[generalHeadingsDict["ZIP Code"]]}
	location = row[generalHeadingsDict["Location"]]
	
	latLongArray = ["",""]
	latLongs = re.findall("(-?\d+.?\d+, -?\d+.\d+)", location)
	if (len(latLongs) > 0):
		latLongArray = latLongs[0].replace(" ","").split(",")
		try:
			latLongArray = [float(loc) for loc in latLongArray]
		except:
			latLongArray = ["",""]

	hospitalDict[hospital] = {
		"Address": address,
		"Hospital": hospital,
		"Lat": latLongArray[0],
		"Long": latLongArray[1],
	}
#Get the survey respons for each hospital
surveyFile = "./csv_data/HCAHPS - Hospital.csv"

with open(surveyFile, 'rb') as csvfile:
	reader = csv.reader(csvfile, delimiter=',', quotechar='"')
	rows = list(reader)

headings = rows[0]
surveyHeadingsDict = dict()
for i,heading in enumerate(headings):
	surveyHeadingsDict[heading] = i

for row in rows[1:]:
	question = row[surveyHeadingsDict["HCAHPS Measure ID"]]
	if (question == "H_STAR_RATING"):
		hospital = row[surveyHeadingsDict["Hospital Name"]]
		if (hospital in hospitalDict):
			hospitalDict[hospital]["StarRating"] = row[surveyHeadingsDict["Patient Survey Star Rating"]]
		else:
			hospitalDict[hospital] = {
				"StarRating": row[surveyHeadingsDict["Patient Survey Star Rating"]]
			}

#Get the survey respons for each hospital
readmissionDeathsFile = "./csv_data/Readmissions and Deaths - Hospital.csv"

with open(readmissionDeathsFile, 'rb') as csvfile:
	reader = csv.reader(csvfile, delimiter=',', quotechar='"')
	rows = list(reader)

headings = rows[0]
readmissionDeathsHeadingsDict = dict()
for i,heading in enumerate(headings):
	readmissionDeathsHeadingsDict[heading] = i

for row in rows[1:]:
	hospital = row[surveyHeadingsDict["Hospital Name"]]
	measure = row[readmissionDeathsHeadingsDict["Measure ID"]]
	score = row[readmissionDeathsHeadingsDict["Score"]]

	print measure,score
	if (hospital in hospitalDict):
		if ("QualityMeasures" in hospitalDict[hospital]):
			hospitalDict[hospital]["QualityMeasures"][measure] = score
		else:
			hospitalDict[hospital]["QualityMeasures"] = {measure: score}
	else:
		hospitalDict[hospital] = {
			"QualityMeasures": {measure: score}
		}

#Write Everything into a Json file!
hospitalJSONList = hospitalDict.values()


with open('hospitalData.json', 'w') as outfile:
    json.dump(hospitalJSONList, outfile)



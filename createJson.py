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
	starRatingQuestions = ["H_STAR_RATING", 
	"H_CLEAN_STAR_RATING", 
	"H_COMP_1_STAR_RATING", 
	"H_COMP_2_STAR_RATING", 
	"H_COMP_3_STAR_RATING",
	"H_COMP_4_STAR_RATING",
	"H_COMP_5_STAR_RATING",
	"H_COMP_6_STAR_RATING",
	"H_COMP_7_STAR_RATING",
	"H_HSP_RATING_STAR_RATING",
	"H_QUIET_STAR_RATING",
	"H_RECMND_STAR_RATING",
	]
	if (question in starRatingQuestions):
		hospital = row[surveyHeadingsDict["Hospital Name"]]
		if (hospital in hospitalDict):
			if ("StarRatings" in hospitalDict[hospital]):
				hospitalDict[hospital]["StarRatings"][question] = row[surveyHeadingsDict["Patient Survey Star Rating"]]
			else:
				hospitalDict[hospital]["StarRatings"] = {question: row[surveyHeadingsDict["Patient Survey Star Rating"]]}
		else:
			hospitalDict[hospital] = {
				"StarRatings": {question: row[surveyHeadingsDict["Patient Survey Star Rating"]]}
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

	if (hospital in hospitalDict):
		if ("ReadmissionsAndDeaths" in hospitalDict[hospital]):
			hospitalDict[hospital]["ReadmissionsAndDeaths"][measure] = score
		else:
			hospitalDict[hospital]["ReadmissionsAndDeaths"] = {measure: score}
	else:
		hospitalDict[hospital] = {
			"ReadmissionsAndDeaths": {measure: score}
		}

#Write Everything into a Json file!
hospitalJSONList = hospitalDict.values()


with open('hospitalData.json', 'w') as outfile:
    json.dump(hospitalJSONList, outfile)



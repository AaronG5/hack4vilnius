# USER FLOW DOCUMENT

## Pages

### User Pages
The user design is mobile oriented, so that users can report problems while on the go. It is simple and has an intuitive and faster UX.

#### Map
Interactive map, where the users can see the unconfirmed, confirmed, ongoing and  pending problems. The user can filter which problems they see.

#### Challange list
A list of city created challanges that the users can participate in.

#### Challange details
A page that provides details about a specific challange. This page provides progress milestones, participant count, district contribution numbers.


#### Badge showcase
A page where the user can view the badges that he has earned.

### City Administrator Pages
The city administrator design is computer oriented. It has more complex data presented like graphs, charts, numbers etc..

#### List of problems
A list of problems where the city administrator can mark problems as ongoing. The problems can be sorted by urgency, age and filtered by district and urgency.


## User Flow

### Liftime of an infrastructure problem
1. A user notices a problem in a city (evrything, ranging from potholes to plant diseases), then photographs, films or record audio, adds a short text description. AI analyses the problem submission and determines its category and if the report is malicious or legit. If there are similar reports nearby (10 meters or so) of a similar nature the user is prompted if they are reporting a problem that has been reported before, if they choose that it is, the report is assigned to the same problem. If the report is for a new problem then the AI suggests categories that are the best fit (there is always an option other). The user chooses the best suiting category and presses publish.
2. AI analyses report for abuse and unethical reports. Scans for illegal activites, insults and other undesireable contents. If the report does not pass the filter it is flagged for administrative staff. If staff approove the report is harmful, then the trust score of the user that reported is lowered.
3. AI analyses the submitted report and adds an urgency (can wait, urgent and dangerous to life) estimate and a legitimacy percentage score (evaluates based on the contents of the foto, trust score of the user who submitted). The problem is marked as unconfirmed and is displayed as a red questionmark on the map.
4. Based on the reports urgency (more points offered as reward for users who validate the report for more urgent problems) and legitimacy (less legitimate reports need more validations) users are prompted on the map to validate
5. Enough validations are reached, the problem is marked as confirmed and is passed on to the relevant institution based on the category. Users who reported or validated the problem are informed via notifications of the problems status change. The problem is marked as a red marker on the map. The user who reported the problem is awarded points, the amount based on the quality of his report (presence of video and photos gives extra points). Users who validated are awarded points based on how much extra information they provided (better text description, more up to date photos and videos).
6. Sometimes users who are passing though the confirmed problem are prompted by a notification to update the status (A.K.A. check if the problem has progressed, has the urgency changed).
7. Responsible insitution announces that it is currently working on fixing the problem, the problem is marked as ongoing. Users who reported or validated the problem are informed via notifications of the problems status change. The problem is marked as a yellow marker on the full map.
8. Responsible insitution announces that the problem is fixed, the problem is marked as pending. Users who reported or validated the problem are informed via notifications of the problems status change. The problem is marked as a green question mark on the map.
9. If enough users validate that the problem is fixed it is marked as completed and disappears from the map, if users say that the problem is not fixed it is marked as valid. Users who reported or validated the problem are informed via notifications of the problems status change.

## City Administrators flow

## App Administrators flow
### 

### Add new city
Program administrator opens the django admin panel, and creates new instance of a city.

### Add new district
Program administrator opens the django admin panel, and creates new instance of a district.

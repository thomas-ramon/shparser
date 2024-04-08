let form = document.getElementById("form");
let gen = document.getElementById("list");
const arrayList = [];

const parse = (strings) => {
    // Split the text into lines
const lines = strings.split('\n');

// Initialize an array to hold the groups
let groups = [];

// Iterate over the lines
lines.forEach(line => {
 // Check if the line contains an 8-character ID
 const match = line.match(/^(.*)(\d{8}).*/);
 const getType = (e) => e.match(/^\s*\w+/)[0];

 if (match) {
    // If it does, create a new group object
    groups.push({
      content: [],
      type: getType(match[1]), // hospit vs consult = start of line w/ id
      id: match[2], // id # IPP
    });
 } else if (groups.length > 0) {
    let arr = groups[groups.length - 1].content;
    // If it doesn't, add the line to the last group's content
    if (arr.length > 0 && /\)$/.test(arr[arr.length -1])) {
        // si le précédent correspond à une ligne d'UF
        // alors celui ci correspond à un timestamp et est couplé au précédent
        arr[arr.length -1] += line;
    } else {
        // sinon on ajoute un nouvel item
        arr.push(line);
    }
 }
});

// Map all content to format the data
const update = groups.map(obj => {
    const str = obj.content;
    obj.content.reverse(); // inverse ordre pour chronologie
 
    const alt = str.map((p,i) => {
        const data = {};
        // const fr = 'CONSULT NEPHRO ET SUIVIS  (5074)A partir du 05/04/2024 à 07:00';
        const regex2 = /(.*)\((\d{4})\).*?(\d{2}\/\d{2}\/\d{4}).*?(\d{2}\:\d{2})(?:.*?(\d{2}\/\d{2}\/\d{4}).*?(\d{2}\:\d{2}))?$/g;
        // const cap = fr.matchAll(regex2);
        const captures = [...p.matchAll(regex2)]
        captures.forEach(m => {
            const [, unit, code, start, hourstart, end, hourend] = m;
            data.UF = unit.trim();
            data.code = code;
            data.start = start;
            data.starthour = hourstart;
            data.end = end;
            data.endhour = hourend;
        })

        return ({
            index: i,
            ...data
        })
     })

    return {...obj, content: alt}
})

return update;
};

form.addEventListener("submit", (e) => {
    e.preventDefault();

    let name = document.getElementById("name").value;
    let raw = document.getElementById("content").value;
    let options = Array.from(document.querySelectorAll('input[name="options"]:checked')).map(function(input) {
    return input.value;
 });
console.log(options);
    const dataset = {events: parse(raw), name: name};
    

    const ulElement = document.createElement('div');
    ulElement.innerHTML += `${name} - ${dataset.events.length} évènements`;
    gen.appendChild(ulElement);
    arrayList.push(dataset);
    form.reset();

    console.log(dataset)
});

gen.addEventListener("submit", (e) => {
    e.preventDefault();

    const ics = new ICAL.Component(['vcalendar', [], []]);
    ics.updatePropertyWithValue('prodid', '-//Test Example');
    const patients = arrayList;

// Iterate through each patient
patients.forEach(patient => {
    // Iterate through each event in the patient's list
    patient.events.forEach(event => {
       // Iterate through each content item within the event
       event.content.forEach(eventContent => {

	   // If no start date or hour, return
	   if (eventContent.start === undefined || eventContent.starthour === undefined) {
		return;
	   }

           // Create a new vevent component for each appointment
           const vevent = new ICAL.Component('vevent');
           
           // Combine date and hour to create a full datetime string in the correct format
           const startDateTime = `${eventContent.start.split('/').reverse().join('-')}T${eventContent.starthour}:00`;
           
           // Create a timezone object for Paris
           const tzid = new ICAL.Timezone({ tzid: "Europe/Paris" });
           
           // Manually set the timezone for the start time
           const startTime = ICAL.Time.fromDateTimeString(startDateTime);
           startTime.zone = tzid;
           
           // Check if the event has an end time and hour
           if (eventContent.end && eventContent.endhour) {
               const endDateTime = `${eventContent.end.split('/').reverse().join('-')}T${eventContent.endhour}:00`;
               const endTime = ICAL.Time.fromDateTimeString(endDateTime);
               endTime.zone = tzid; // Manually set the timezone for the end time
               vevent.addPropertyWithValue('dtend', endTime);
           } else {
               // Optionally, you can set a default end time or omit the dtend property
               // For example, setting a default end time 24 hours after the start time
               const endTime = startTime.clone();
               endTime.addDuration({ hours: 24 });
               vevent.addPropertyWithValue('dtend', endTime);
           }
           
           vevent.addPropertyWithValue('dtstart', startTime);
           
           vevent.addPropertyWithValue('summary', `${patient.name}
           ${eventContent.UF} (${eventContent.code})`);
           // Assuming the location is part of the event content, adjust as necessary
           vevent.addPropertyWithValue('location', eventContent.code);
           vevent.addPropertyWithValue('categories', event.type);
           vevent.addPropertyWithValue('x-patient', patient.name);
           
           ics.addSubcomponent(vevent);
       });
    });
   });

   // Convert the iCalendar object to a string
//    const icsString = ICAL.stringify(ics);
   const icsString = ics.toString();

   console.log(ics);
   console.log(icsString);

   
   // Now you can use the icsString as needed, e.g., download it as a file

const blob = new Blob([icsString], { type: 'text/calendar;charset=utf-8;' });
const link = document.createElement('a');
link.href = URL.createObjectURL(blob);
link.download = 'patient_appointments.ics';
link.click();

});

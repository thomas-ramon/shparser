const patientForm = document.getElementById("form");
const optionForm = document.getElementById("options");
const tester = document.getElementById("doThis");
const eventsList = [];

// Function to parse the events from the input text
const parseEvents = (text) => {
    const lines = text.split("\n");
    const events = [];

    lines.forEach(line => {
        // Identify lines by IEP code
        const match = line.match(/^(.*)(\b\d{6,8}\b).*/);

        if (match) {
            // If line contains IEP, create new event
            events.push({
                content: [],
                type: match[1].includes("Hospitalisation") ? "Hospitalisation" : match[1].includes("Consultation") ? "Consultation" : "Autre",
                id: match[2]
            });
        } else if (events.length > 0) {
            // Otherwise, fuse it with the previous event
            const lastEventContent = events[events.length - 1].content;

            if (lastEventContent.length > 0 && /\)$/.test(lastEventContent[lastEventContent.length - 1])) {
                lastEventContent[lastEventContent.length - 1] += line;
            } else {
                lastEventContent.push(line);
            }
        }
    });

    // Return parsed events as object
    return events.map(event => {
        const reversedContent = event.content.reverse();
        const parsedContent = reversedContent.map((line, index) => {
            const eventDetails = {};
            const regex = /(.*)\((\d{4})\).*?(\d{2}\/\d{2}\/\d{4}).*?(\d{2}\:\d{2})(?:.*?(\d{2}\/\d{2}\/\d{4}).*?(\d{2}\:\d{2}))?$/g;
            const matches = [...line.matchAll(regex)];

            matches.forEach(match => {
                const [, type, code, startDate, startHour, endDate, endHour] = match;
                eventDetails.type = type.trim();
                eventDetails.code = code;
                eventDetails.start = startDate;
                eventDetails.starthour = startHour;
                eventDetails.end = endDate;
                eventDetails.endhour = endHour;
            });

            return { index, ...eventDetails };
        });

        return { ...event, content: parsedContent };
    });
};

patientForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = document.getElementById("patient-name").value;
    const content = document.getElementById("patient-history").value;

    const parsedEvents = parseEvents(content);
    const eventData = { name, events: parsedEvents };
    const patientList = document.getElementById("patientList");

    // Upon pasting patient data, create and populate a list of all patients
    const liElement = document.createElement("li");
    liElement.classList.add('list-group-item', 'd-flex', 'justify-content-between', 'align-items-start');
    liElement.innerHTML = `
    <div class="ms-2 me-auto">
      <div class="fw-bold">${name}</div>
    </div>
    <span class="badge text-bg-primary rounded-pill">${parsedEvents.length}</span>
    `;
    patientList.appendChild(liElement);

    eventsList.push(eventData);
    patientForm.reset();
    console.log(eventData);
});

tester.addEventListener("click", (event) => {
    event.preventDefault();
    optionList.innerHTML = ''; // Reset UF List

    const uniqueCombinations = eventsList.reduce((acc, obj) => {
        obj.events.forEach(event => {
           event.content.forEach(content => {
             const key = `${content.code}-${event.type}`; // Unique key based on code and type
             if (!acc.has(key)) {
               acc.set(key, { code: content.code, type: content.type });
             }
           });
        });
        return acc;
    }, new Map());
       
    const result = Array.from(uniqueCombinations.values()).sort((a, b) => a.code - b.code);
    ;
    result.forEach(unite => {
        const code = unite.code;
        const service = unite.type;
        const newUnit = document.createElement('div');
        newUnit.classList.add('custom-control', 'custom-checkbox', 'custom-control-inline');
        const optionList = document.getElementById("optionList");
        newUnit.innerHTML = `
            <input name="liste-unites" id="liste-unites_${code}" type="checkbox" checked="checked"
                            class="custom-control-input" value="${code}">
            <label for="liste-unites" class="custom-control-label">${code} - ${service}</label>
        `;
        optionList.appendChild(newUnit);
    })
});

optionForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const title = document.getElementById("ics-file-name").value;
    const checked = optionForm.querySelectorAll('input[type="checkbox"]:checked');
    const checkedValues = Array.from(checked).map(checkbox => checkbox.value);

    const vCalendar = new ICAL.Component(["vcalendar", [], []]);
    vCalendar.updatePropertyWithValue("prodid", "-//Test Example");

    const allEvents = eventsList;

    // Create events in ics format
    allEvents.forEach(eventData => {
        eventData.events.forEach(event => {         
            event.content.forEach(details => {
                
                // return if UF not to included in options
                if(!checkedValues.includes(details.code)) {
                    return;
                }

                const startDateTime = `${details.start.split("/").reverse().join("-")}T${details.starthour}:00`;
                const timezone = new ICAL.Timezone({ tzid: "Europe/Paris" });
                const startTime = ICAL.Time.fromDateTimeString(startDateTime);
                startTime.zone = timezone;
                const vEvent = new ICAL.Component("vevent");
                vEvent.addPropertyWithValue("dtstart", startTime);
                vEvent.addPropertyWithValue("summary", `${eventData.name} - ${details.type}`);

                if (details.end && details.endhour) {
                    const endDateTime = `${details.end.split("/").reverse().join("-")}T${details.endhour}:00`;
                    const endTime = ICAL.Time.fromDateTimeString(endDateTime);
                    endTime.zone = timezone;
                    vEvent.addPropertyWithValue("dtend", endTime);
                } else {
                    const nextDay = startTime.clone();
                    nextDay.addDuration({ hours: 24 });
                    vEvent.addPropertyWithValue("dtend", nextDay);
                }

                vCalendar.addSubcomponent(vEvent);
            });
        });
    });

    // Generate and download .ics file
    const icsString = vCalendar.toString();
    const blob = new Blob([icsString], { type: 'text/calendar;charset=utf-8;' });
    const link = document.createElement('a');

    console.log(icsString);
    link.href = URL.createObjectURL(blob);
    link.download = `${title}.ics`;
    link.click();
});

// Function to check all checkboxes
function checkAll() {
    let checkboxes = document.querySelectorAll('input[name="liste-unites"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = true;
    });
}

// Function to uncheck all checkboxes
function uncheckAll() {
    let checkboxes = document.querySelectorAll('input[name="liste-unites"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
}

// Event listeners for the buttons
document.getElementById('checkAll').addEventListener('click', checkAll);
document.getElementById('uncheckAll').addEventListener('click', uncheckAll);

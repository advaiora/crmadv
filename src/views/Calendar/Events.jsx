import moment from "moment";
import { colorToRgbaString, readBrandingColor } from "../../lib/brandingColors";

var curYear = moment().format("YYYY"),
  curMonth = moment().format("MM");

export const getCalendarEvents = ({ primaryColor, secondaryColor } = {}) => {
  const resolvedPrimaryColor = primaryColor || readBrandingColor("--bs-primary", "#0d6efd");
  const resolvedSecondaryColor = secondaryColor || readBrandingColor("--bs-secondary", "#6c757d");
  const softPrimaryColor = colorToRgbaString(resolvedPrimaryColor, 0.75, "#0d6efd");
  const mutedPrimaryColor = colorToRgbaString(resolvedPrimaryColor, 0.45, "#0d6efd");

  return [
    {
      backgroundColor: resolvedPrimaryColor,
      borderColor: resolvedPrimaryColor,
      title: "9:30 AM - 8:00 PM Awwards Conference",
      start: curYear + "-" + curMonth + "-04",
      end: curYear + "-" + curMonth + "-06",
    },
    {
      backgroundColor: resolvedSecondaryColor,
      borderColor: resolvedSecondaryColor,
      title: "Jampack Team Meet",
      start: curYear + "-" + curMonth + "-13",
      end: curYear + "-" + curMonth + "-15",
    },
    {
      backgroundColor: resolvedSecondaryColor,
      borderColor: resolvedSecondaryColor,
      title: "Project meeting with delegates",
      start: curYear + "-" + curMonth + "-19",
    },
    {
      backgroundColor: softPrimaryColor,
      borderColor: softPrimaryColor,
      title: "Conference",
      start: curYear + "-" + curMonth + "-11",
      end: curYear + "-" + curMonth + "-13",
    },
    {
      title: "Call back to Morgan Freeman",
      start: curYear + "-" + curMonth + "-27T10:30:00",
    },
    {
      title: "Grocery Day",
      start: curYear + "-" + curMonth + "-27T12:00:00",
    },
    {
      title: "Follow-up call with client",
      start: curYear + "-" + curMonth + "-7T14:30:00",
    },
    {
      title: "Follow-up call with client",
      start: curYear + "-" + curMonth + "-07T07:00:00",
    },
    {
      title: "Grocery Day",
      start: curYear + "-" + curMonth + "-02T07:00:00",
    },
    {
      backgroundColor: mutedPrimaryColor,
      borderColor: mutedPrimaryColor,
      title: "Flight to Indonesia",
      start: curYear + "-" + curMonth + "-13",
    },
    {
      backgroundColor: resolvedPrimaryColor,
      borderColor: resolvedPrimaryColor,
      title: "Boss Birthday",
      start: curYear + "-" + curMonth + "-29",
    },
  ];
};

export const CalendarEvents = getCalendarEvents();

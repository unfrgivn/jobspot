import { google } from "googleapis";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
];
const REDIRECT_URI = process.env.GOOGLE_CALENDAR_REDIRECT_URI || "http://localhost:3001/api/oauth/google/callback";

export interface CalendarCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken?: string;
}

export interface CalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  conferenceLink?: string;
}

function createOAuth2Client(credentials: CalendarCredentials) {
  const oauth2Client = new google.auth.OAuth2(
    credentials.clientId,
    credentials.clientSecret,
    REDIRECT_URI
  );

  if (credentials.refreshToken) {
    oauth2Client.setCredentials({
      refresh_token: credentials.refreshToken,
    });
  }

  return oauth2Client;
}

export function generateAuthUrl(credentials: CalendarCredentials): string {
  const oauth2Client = createOAuth2Client(credentials);
  
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });
}

export async function exchangeCodeForTokens(
  credentials: CalendarCredentials,
  code: string
): Promise<string | null> {
  const oauth2Client = createOAuth2Client(credentials);
  
  const { tokens } = await oauth2Client.getToken(code);
  return tokens.refresh_token || null;
}

export interface CalendarListItem {
  id: string;
  summary: string;
  primary?: boolean;
}

export async function listCalendars(
  credentials: CalendarCredentials
): Promise<CalendarListItem[]> {
  if (!credentials.refreshToken) {
    throw new Error("No refresh token available. Please authorize Google Calendar first.");
  }

  const oauth2Client = createOAuth2Client(credentials);
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  const response = await calendar.calendarList.list({
    minAccessRole: "writer",
  });

  return (response.data.items || []).map((cal) => ({
    id: cal.id || "",
    summary: cal.summary || "",
    primary: cal.primary || false,
  }));
}

export async function createCalendarEvent(
  credentials: CalendarCredentials,
  event: CalendarEvent,
  calendarId: string = "primary"
): Promise<string | null> {
  if (!credentials.refreshToken) {
    throw new Error("No refresh token available. Please authorize Google Calendar first.");
  }

  const oauth2Client = createOAuth2Client(credentials);
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  const eventBody: {
    summary: string;
    description?: string;
    location?: string;
    start: { dateTime: string; timeZone: string };
    end: { dateTime: string; timeZone: string };
    conferenceData?: {
      entryPoints: Array<{ entryPointType: string; uri: string; label: string }>;
    };
  } = {
    summary: event.summary,
    description: event.description,
    location: event.location,
    start: {
      dateTime: event.startTime.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    end: {
      dateTime: event.endTime.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  };

  if (event.conferenceLink) {
    eventBody.conferenceData = {
      entryPoints: [
        {
          entryPointType: "video",
          uri: event.conferenceLink,
          label: "Join Meeting",
        },
      ],
    };
  }

  const response = await calendar.events.insert({
    calendarId,
    requestBody: eventBody,
  });

  return response.data.id || null;
}

export async function updateCalendarEvent(
  credentials: CalendarCredentials,
  eventId: string,
  event: CalendarEvent,
  calendarId: string = "primary"
): Promise<void> {
  if (!credentials.refreshToken) {
    throw new Error("No refresh token available. Please authorize Google Calendar first.");
  }

  const oauth2Client = createOAuth2Client(credentials);
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  const eventBody: {
    summary: string;
    description?: string;
    location?: string;
    start: { dateTime: string; timeZone: string };
    end: { dateTime: string; timeZone: string };
    conferenceData?: {
      entryPoints: Array<{ entryPointType: string; uri: string; label: string }>;
    };
  } = {
    summary: event.summary,
    description: event.description,
    location: event.location,
    start: {
      dateTime: event.startTime.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    end: {
      dateTime: event.endTime.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  };

  if (event.conferenceLink) {
    eventBody.conferenceData = {
      entryPoints: [
        {
          entryPointType: "video",
          uri: event.conferenceLink,
          label: "Join Meeting",
        },
      ],
    };
  }

  await calendar.events.update({
    calendarId,
    eventId,
    requestBody: eventBody,
  });
}

export async function deleteCalendarEvent(
  credentials: CalendarCredentials,
  eventId: string,
  calendarId: string = "primary"
): Promise<void> {
  if (!credentials.refreshToken) {
    throw new Error("No refresh token available. Please authorize Google Calendar first.");
  }

  const oauth2Client = createOAuth2Client(credentials);
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  await calendar.events.delete({
    calendarId,
    eventId,
  });
}

export interface CalendarEventItem {
  id: string;
  summary: string;
  description?: string;
  startTime: string;
  endTime: string;
  location?: string;
  htmlLink?: string;
  conferenceLink?: string;
}

export async function getUpcomingEvents(
  credentials: CalendarCredentials,
  calendarId: string = "primary",
  maxResults: number = 20
): Promise<CalendarEventItem[]> {
  if (!credentials.refreshToken) {
    throw new Error("No refresh token available. Please authorize Google Calendar first.");
  }

  const oauth2Client = createOAuth2Client(credentials);
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  const now = new Date();
  const response = await calendar.events.list({
    calendarId,
    timeMin: now.toISOString(),
    maxResults,
    singleEvents: true,
    orderBy: "startTime",
  });

  return (response.data.items || []).map((event) => {
    const conferenceData = event.conferenceData;
    const videoEntry = conferenceData?.entryPoints?.find(ep => ep.entryPointType === "video");
    
    return {
      id: event.id || "",
      summary: event.summary || "(No title)",
      description: event.description || undefined,
      startTime: event.start?.dateTime || event.start?.date || "",
      endTime: event.end?.dateTime || event.end?.date || "",
      location: event.location || undefined,
      htmlLink: event.htmlLink || undefined,
      conferenceLink: videoEntry?.uri || event.hangoutLink || undefined,
    };
  });
}

export function isCalendarConfigured(credentials: Partial<CalendarCredentials>): boolean {
  return !!(credentials.clientId && credentials.clientSecret);
}

export function isCalendarConnected(credentials: Partial<CalendarCredentials>): boolean {
  return !!(credentials.clientId && credentials.clientSecret && credentials.refreshToken);
}

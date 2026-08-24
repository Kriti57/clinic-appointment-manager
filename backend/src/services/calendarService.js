import { google } from "googleapis";
import User from "../models/User.js";

const oauth2Client = () =>
  new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

export const getAuthUrl = (userId) => {
  const client = oauth2Client();
  return client.generateAuthUrl({
    access_type: "offline", // needed to get a refresh token
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/calendar.events"],
    state: userId, // so we know which user to attach tokens to on callback
  });
};

export const handleOAuthCallback = async (code, userId) => {
  const client = oauth2Client();
  const { tokens } = await client.getToken(code);

  await User.findByIdAndUpdate(userId, {
    googleTokens: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate: tokens.expiry_date,
    },
  });
};

// Builds an authenticated client for a specific user, using their stored tokens.
// googleapis auto-refreshes the access token using the refresh token when expired.
const getClientForUser = (user) => {
  if (!user.googleTokens?.refreshToken) return null;
  const client = oauth2Client();
  client.setCredentials({
    access_token: user.googleTokens.accessToken,
    refresh_token: user.googleTokens.refreshToken,
    expiry_date: user.googleTokens.expiryDate,
  });
  return client;
};

// Returns null (does not throw) if the user hasn't connected Google Calendar -
// calendar sync is a bonus feature, not something that should block booking.
export const createCalendarEvent = async (user, { summary, description, date, slotTime, durationMinutes }) => {
  const client = getClientForUser(user);
  if (!client) return null;

  const calendar = google.calendar({ version: "v3", auth: client });
  const startDateTime = new Date(`${date}T${slotTime}:00`);
  const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60000);

  try {
    const event = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary,
        description,
        start: { dateTime: startDateTime.toISOString() },
        end: { dateTime: endDateTime.toISOString() },
      },
    });
    return event.data.id;
  } catch (err) {
    console.error(`Calendar event creation failed for user ${user._id}:`, err.message);
    return null;
  }
};

export const updateCalendarEvent = async (user, eventId, { date, slotTime, durationMinutes }) => {
  const client = getClientForUser(user);
  if (!client || !eventId) return;

  const calendar = google.calendar({ version: "v3", auth: client });
  const startDateTime = new Date(`${date}T${slotTime}:00`);
  const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60000);

  try {
    await calendar.events.patch({
      calendarId: "primary",
      eventId,
      requestBody: {
        start: { dateTime: startDateTime.toISOString() },
        end: { dateTime: endDateTime.toISOString() },
      },
    });
  } catch (err) {
    console.error(`Calendar event update failed:`, err.message);
  }
};

export const deleteCalendarEvent = async (user, eventId) => {
  const client = getClientForUser(user);
  if (!client || !eventId) return;

  const calendar = google.calendar({ version: "v3", auth: client });
  try {
    await calendar.events.delete({ calendarId: "primary", eventId });
  } catch (err) {
    console.error(`Calendar event deletion failed:`, err.message);
  }
};

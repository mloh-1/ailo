import { NextResponse } from "next/server";
import { calendlyFetch } from "@/lib/calendly-oauth";

export async function GET() {
  try {
    if (!process.env.CALENDLY_REFRESH_TOKEN) {
      return NextResponse.json({ slots: null, error: "Calendly OAuth not configured" });
    }

    // Step 1: Get current user to get their URI
    const userResponse = await calendlyFetch("/users/me") as { resource: { uri: string } };
    const userUri = userResponse.resource.uri;

    // Step 2: Get event types for this user
    const eventTypesResponse = await calendlyFetch(
      `/event_types?user=${encodeURIComponent(userUri)}&active=true`
    ) as { collection: { scheduling_url: string; uri: string }[] };

    // Find the event type that matches our configured URL
    const calendlyUrl = process.env.NEXT_PUBLIC_CALENDLY_URL || "";
    const eventTypes = eventTypesResponse.collection || [];

    // Extract slug from URL (e.g., "30min" from "https://calendly.com/nikolagymnastics/30min")
    const urlSlug = calendlyUrl.split("/").pop();

    const matchingEventType = eventTypes.find(
      (et: { scheduling_url: string }) =>
        et.scheduling_url === calendlyUrl ||
        et.scheduling_url.endsWith(`/${urlSlug}`)
    );

    if (!matchingEventType) {
      return NextResponse.json({
        slots: null,
        error: "Event type not found",
      });
    }

    // Step 3: Get available times for the current calendar week (Monday to Sunday)
    const now = new Date();

    // Get end of current week (Sunday 23:59:59)
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
    const endOfWeek = new Date(now);
    endOfWeek.setDate(now.getDate() + daysUntilSunday);
    endOfWeek.setHours(23, 59, 59, 999);

    // Start time: 1 minute from now (must be in the future for Calendly)
    const startTime = new Date(now.getTime() + 60 * 1000).toISOString();
    const endTime = endOfWeek.toISOString();

    const availabilityResponse = await calendlyFetch(
      `/event_type_available_times?event_type=${encodeURIComponent(
        matchingEventType.uri
      )}&start_time=${startTime}&end_time=${endTime}`
    ) as { collection: unknown[] };

    const availableSlots = availabilityResponse.collection || [];
    const slotCount = availableSlots.length;

    return NextResponse.json({
      slots: slotCount,
      cached: false,
    });
  } catch (error) {
    console.error("Error fetching Calendly availability:", error);
    return NextResponse.json({
      slots: null,
      error: "Failed to fetch availability",
    });
  }
}

import { APIRequestContext, APIResponse, expect } from '@playwright/test';
import { VISITS_ENDPOINTS } from './endpoints';
import { PeopleClient } from './people';
import { DatabaseClient } from './database';
import { COLLECTIONS } from './collections';
import { expectStatus, readJson } from '../helpers/http';
import { Person, Role } from '../helpers/models/person';
import { ClosingMovementType, MovementPayload, Visit, VisitMovement, VisitPayload, VisitStatus } from '../helpers/models/visit';
import { buildPerson, TEST_DATA_PREFIX } from '../payloads/person';
import { buildVisit } from '../payloads/visit';

export type VisitListQuery = Record<string, string | number>;
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Property names accepted as the array of a paginated list envelope. The
 * requirement asks for pagination without defining the response shape, so a
 * bare array (the HHM convention) and the common envelopes are both accepted.
 */
const LIST_ENVELOPE_KEYS = ['items', 'data', 'results', 'visits'] as const;

/** Extracts the array of a list response, accepting a bare array or a pagination envelope. */
export function extractList<T>(body: unknown, context: string): T[] {
  if (Array.isArray(body)) {
    return body as T[];
  }

  if (body && typeof body === 'object') {
    for (const key of LIST_ENVELOPE_KEYS) {
      const candidate = (body as Record<string, unknown>)[key];

      if (Array.isArray(candidate)) {
        return candidate as T[];
      }
    }
  }

  throw new Error(`${context} must return an array or a pagination envelope. Body: ${JSON.stringify(body).slice(0, 300)}`);
}

/**
 * Client for the Visits and Visit Movements API (REQ-VIS-001).
 *
 * Raw methods return the APIResponse so specs can assert status codes and
 * error bodies; assertive helpers are meant for scenario preconditions.
 *
 * The API exposes no deletion for visits or movements (rule 15), so `cleanup()`
 * removes every visit the scenario created, together with its movements,
 * directly in the database. The people it registered are then deleted by the
 * People client, so a finished scenario leaves no data behind. Without a
 * database (cleanup disabled) the visits stay, and so do their people.
 */
export class VisitsClient {
  private readonly createdVisitIds = new Set<string>();
  private readonly registeredPeopleIds = new Set<string>();

  constructor(
    private readonly request: APIRequestContext,
    private readonly people: PeopleClient,
    private readonly database: DatabaseClient | undefined,
  ) {}

  // ---------- Visits: raw requests ----------

  async create(payload: unknown): Promise<APIResponse> {
    const response = await this.request.post(VISITS_ENDPOINTS.root, { data: payload as object });
    await this.trackVisit(response);

    return response;
  }

  /** Sends a raw, possibly malformed, JSON body to the create endpoint. */
  async createRaw(body: string): Promise<APIResponse> {
    const response = await this.request.post(VISITS_ENDPOINTS.root, {
      headers: { 'Content-Type': 'application/json' },
      data: body,
    });
    await this.trackVisit(response);

    return response;
  }

  async update(id: string, payload: unknown): Promise<APIResponse> {
    return this.request.put(VISITS_ENDPOINTS.byId(id), { data: payload as object });
  }

  async findAll(query: VisitListQuery = {}): Promise<APIResponse> {
    return this.request.get(VISITS_ENDPOINTS.root, { params: query });
  }

  async findById(id: string): Promise<APIResponse> {
    return this.request.get(VISITS_ENDPOINTS.byId(id));
  }

  async findByPatient(patientId: string): Promise<APIResponse> {
    return this.request.get(VISITS_ENDPOINTS.byPatient(patientId));
  }

  // ---------- Movements: raw requests ----------

  async addMovement(visitId: string, payload: unknown): Promise<APIResponse> {
    return this.request.post(VISITS_ENDPOINTS.movements(visitId), { data: payload as object });
  }

  async findMovements(visitId: string): Promise<APIResponse> {
    return this.request.get(VISITS_ENDPOINTS.movements(visitId));
  }

  /** Sends an arbitrary request, used to probe endpoints the requirement forbids exposing. */
  async send(method: HttpMethod, path: string, payload?: unknown): Promise<APIResponse> {
    return this.request.fetch(path, { method, data: payload as object | undefined });
  }

  // ---------- Assertive helpers for preconditions ----------

  /** Registers a person holding the PATIENT role (plus any extra roles) through the People API. */
  async registerPatient(extraRoles: Role[] = []): Promise<Person> {
    return this.registerPerson(['PATIENT', ...extraRoles]);
  }

  /** Registers a person with the given roles, adding the custom role the People API requires with OTHER. */
  async registerPerson(roles: Role[]): Promise<Person> {
    const payload = buildPerson({ roles });

    if (roles.includes('OTHER')) {
      payload.custom_roles = [`${TEST_DATA_PREFIX} Custom`];
    }

    const person = await this.people.createPerson(payload);
    this.registeredPeopleIds.add(person._id);

    return person;
  }

  async openVisit(payload: unknown): Promise<Visit> {
    const response = await this.create(payload);
    await expectStatus(response, 201);

    return readJson<Visit>(response);
  }

  async getVisit(id: string): Promise<Visit> {
    const response = await this.findById(id);
    await expectStatus(response, 200);

    return readJson<Visit>(response);
  }

  async listVisits(query: VisitListQuery = {}): Promise<Visit[]> {
    const response = await this.findAll(query);
    await expectStatus(response, 200);

    return extractList<Visit>(await readJson<unknown>(response), VISITS_ENDPOINTS.root);
  }

  async listPatientVisits(patientId: string): Promise<Visit[]> {
    const response = await this.findByPatient(patientId);
    await expectStatus(response, 200);

    return extractList<Visit>(await readJson<unknown>(response), VISITS_ENDPOINTS.byPatient(patientId));
  }

  async appendMovement(visitId: string, payload: MovementPayload): Promise<VisitMovement> {
    const response = await this.addMovement(visitId, payload);
    await expectStatus(response, 201);

    return readJson<VisitMovement>(response);
  }

  async getTimeline(visitId: string): Promise<VisitMovement[]> {
    const response = await this.findMovements(visitId);
    await expectStatus(response, 200);
    const body = await readJson<unknown>(response);
    expect(Array.isArray(body), `${VISITS_ENDPOINTS.movements(visitId)} must return an array`).toBe(true);

    return body as VisitMovement[];
  }

  /** Closes a visit with a DISCHARGE or CANCELLATION movement and returns the persisted visit. */
  async closeVisit(visitId: string, type: ClosingMovementType = 'DISCHARGE'): Promise<Visit> {
    await this.appendMovement(visitId, { type });

    return this.getVisit(visitId);
  }

  /**
   * Registers a new patient and drives a fresh visit to the requested status
   * using only the documented transitions (CARE_STARTED, DISCHARGE, CANCELLATION).
   */
  async createVisitInStatus(
    status: VisitStatus,
    overrides: Partial<VisitPayload> = {},
  ): Promise<{ patient: Person; visit: Visit }> {
    const patient = await this.registerPatient();
    const opened = await this.openVisit(buildVisit(patient._id, overrides));

    if (status === 'IN_PROGRESS' || status === 'COMPLETED') {
      await this.appendMovement(opened._id, { type: 'CARE_STARTED' });
    }

    if (status === 'COMPLETED') {
      await this.appendMovement(opened._id, { type: 'DISCHARGE' });
    }

    if (status === 'CANCELLED') {
      await this.appendMovement(opened._id, { type: 'CANCELLATION' });
    }

    const visit = await this.getVisit(opened._id);
    expect(visit.status, `Precondition: visit ${visit._id} must be ${status}`).toBe(status);

    return { patient, visit };
  }

  // ---------- Isolation ----------

  /**
   * Purges every visit created by the scenario, and every visit of the people
   * it registered, with all their movements. Runs before the People cleanup,
   * so no visit is ever left pointing at a deleted person. A failure is
   * reported instead of swallowed, because it would leave data behind. When
   * database cleanup is disabled, the registered people are kept instead.
   */
  async cleanup(): Promise<void> {
    if (this.database) {
      await this.database.purge(COLLECTIONS.visits, { ids: [...this.createdVisitIds], ownerIds: [...this.registeredPeopleIds] });
    } else {
      this.registeredPeopleIds.forEach((id) => this.people.retain(id));
    }

    this.createdVisitIds.clear();
    this.registeredPeopleIds.clear();
  }

  private async trackVisit(response: APIResponse): Promise<void> {
    if (!response.ok()) {
      return;
    }

    try {
      const body = (await response.json()) as Partial<Visit>;

      if (typeof body?._id === 'string') {
        this.createdVisitIds.add(body._id);
      }
    } catch {
      // Success body without JSON content: visits of registered people are still removed by patient.
    }
  }
}

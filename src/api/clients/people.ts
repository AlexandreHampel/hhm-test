import { APIRequestContext, APIResponse, expect } from '@playwright/test';
import { PEOPLE_ENDPOINTS } from './endpoints';
import { HTTP_STATUS } from '../helpers/expected-status';
import { expectStatus, readJson } from '../helpers/http';
import { Person } from '../helpers/models/person';

/**
 * Client for the People API.
 *
 * Raw methods return the APIResponse for status and body assertions.
 */
export class PeopleClient {
  constructor(private readonly request: APIRequestContext) {}

  async create(payload: unknown): Promise<APIResponse> {
    return this.request.post(PEOPLE_ENDPOINTS.root, { data: payload as object });
  }

  async update(id: string, payload: unknown): Promise<APIResponse> {
    return this.request.put(PEOPLE_ENDPOINTS.byId(id), { data: payload as object });
  }

  async delete(id: string): Promise<APIResponse> {
    return this.request.delete(PEOPLE_ENDPOINTS.byId(id));
  }

  async findAll(): Promise<APIResponse> {
    return this.request.get(PEOPLE_ENDPOINTS.root);
  }

  async findById(id: string): Promise<APIResponse> {
    return this.request.get(PEOPLE_ENDPOINTS.byId(id));
  }

  async findByCpf(cpf: string): Promise<APIResponse> {
    return this.request.get(PEOPLE_ENDPOINTS.byCpf(cpf));
  }

  async findByRole(role: string): Promise<APIResponse> {
    return this.request.get(PEOPLE_ENDPOINTS.byRole(role));
  }

  /** Sends a raw, possibly malformed, JSON body to the create endpoint. */
  async createRaw(body: string): Promise<APIResponse> {
    return this.request.post(PEOPLE_ENDPOINTS.root, {
      headers: { 'Content-Type': 'application/json' },
      data: body,
    });
  }

  /** Creates a person and asserts success. Use it for scenario preconditions. */
  async createPerson(payload: unknown): Promise<Person> {
    const response = await this.create(payload);
    await expectStatus(response, HTTP_STATUS.CREATED);

    return readJson<Person>(response);
  }

  async getPerson(id: string): Promise<Person> {
    const response = await this.findById(id);
    await expectStatus(response, HTTP_STATUS.OK);

    return readJson<Person>(response);
  }

  async listAll(): Promise<Person[]> {
    const response = await this.findAll();
    await expectStatus(response, HTTP_STATUS.OK);
    const body = await readJson<Person[]>(response);
    expect(Array.isArray(body), `${PEOPLE_ENDPOINTS.root} must return an array`).toBe(true);

    return body;
  }

  async listByRole(role: string): Promise<Person[]> {
    const response = await this.findByRole(role);
    await expectStatus(response, HTTP_STATUS.OK);
    const body = await readJson<Person[]>(response);
    expect(Array.isArray(body), `${PEOPLE_ENDPOINTS.byRole(role)} must return an array`).toBe(true);

    return body;
  }

}

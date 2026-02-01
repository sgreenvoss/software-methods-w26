import { createPerson, listPeople } from '../models/person.model.js';

export async function createPersonHandler(req, res, next) {
  try {
    const { firstName, lastName, username, email, googleUserId } = req.body;
    const person = await createPerson({ firstName, lastName, username, email, googleUserId });
    res.json(person);
  } catch (err) {
    next(err);
  }
}

export async function listPeopleHandler(req, res, next) {
  try {
    const people = await listPeople();
    res.json({ people });
  } catch (err) {
    next(err);
  }
}

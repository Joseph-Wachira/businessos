import * as usersService from './users.service.js';

export async function getMe(req, res, next) {
  try {
    res.json(await usersService.getCurrentUser(req.user.id));
  } catch (err) {
    next(err);
  }
}

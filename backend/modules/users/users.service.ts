import repository = require("./users.repository");
import type { UserRecord } from "./users.types";

const getUserByEmployeeID = (studentEmployeeId: string): Promise<UserRecord | null> =>
  repository.findByEmployeeId(studentEmployeeId);

const getUserByID = (id: number): Promise<UserRecord | null> => repository.findById(id);

const updateLastLogin = (userId: number) => repository.updateLastLogin(userId);

export = { getUserByEmployeeID, getUserByID, updateLastLogin };

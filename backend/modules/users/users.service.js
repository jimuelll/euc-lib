const repository = require("./users.repository");

const getUserByEmployeeID = (studentEmployeeId) => repository.findByEmployeeId(studentEmployeeId);

const getUserByID = (id) => repository.findById(id);

const updateUserPassword = (userId, newPasswordHash) => repository.updatePassword(userId, newPasswordHash);

const updateLastLogin = (userId) => repository.updateLastLogin(userId);

module.exports = { getUserByEmployeeID, getUserByID, updateUserPassword, updateLastLogin };

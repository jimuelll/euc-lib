const { createUser, deleteUser, updateUser, searchUsers } = require("./admin.service");

// CREATE
async function handleCreateUser(req, res) {
  try {
    const result = await createUser(req.body, req.user.role);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}

// DELETE
async function handleDeleteUser(req, res) {
  try {
    const { student_employee_id } = req.params;
    const result = await deleteUser(student_employee_id, req.user.role);
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}

// UPDATE
async function handleUpdateUser(req, res) {
  try {
    const { student_employee_id } = req.params;
    const result = await updateUser(student_employee_id, req.body, req.user.role);
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}

// SEARCH
async function handleSearchUsers(req, res) {
  try {
    const result = await searchUsers(req.query);
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}

module.exports = {
  handleCreateUser,
  handleDeleteUser,
  handleUpdateUser,
  handleSearchUsers,
};
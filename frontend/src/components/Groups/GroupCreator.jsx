import React, { useState } from 'react';
import { apiGet, apiPost } from '../../api'
import { Input, Button, Dialog, DialogPanel, DialogTitle } from '@headlessui/react';


// new group creation component
export default function CreateGroupModal({ isOpen, onClose, onGroupCreated }) {
    const [name, setName] = useState('');
    const [user, setUser] = useState('');
    const [suggestions, setSuggestions] = useState([]);

    const handleGroupCreation = async () => {
        try {
            if (name.trim().length === 0) {
                console.log("no group name submitted!!"); //need to add error msg for users
            }
            const res = await apiPost(
                `/group/creation?group_name=${encodeURIComponent(name)}`,
                {}
            );
            if (res.success && res.groupId) {
                onGroupCreated();
            }
        } catch (error) {
            console.error('Error creating group:', error);
        }
    };

    const handleUserInput = async (event) => {
        event.preventDefault();
        const res = await apiGet(`/api/users/search?q=${encodeURIComponent(user)}`);
        console.log("check:", res);
        setUser('');
    };

    return (
        <Dialog open={isOpen} onClose={onClose}>
            <DialogPanel transition>
                <DialogTitle>Create New Group</DialogTitle>
                <p>Enter group name</p>
                <div className="mt-4">
                    <input value={name} onChange={(e) => setName(e.target.value)} />
                    <Button onClick={handleGroupCreation}>Create</Button>
                    <label>Add Users:</label>
                    <form onSubmit={handleUserInput}>
                        <Input value={user} onChange={(e) => setUser(e.target.value)} />
                        <Button type="submit" style={{ display: 'none' }}></Button>
                    </form>
                </div>

                <Button onClick={onClose}>Cancel</Button>
            </DialogPanel>
        </Dialog>
    )
}
import { Poll, Pollster } from "../models/pollModel.js";
import fs from 'fs';
import csv from 'csv-parser';



export const processPollstersCsv = async (pollId, csvFile, uploadedBy) => {
    console.log({ path: csvFile.path })
    return new Promise((resolve, reject) => {
        const pollsters = [];
        const errors = [];
        let rowCount = 0;

        fs.createReadStream(csvFile.path)
            .pipe(csv())
            .on('data', (row) => {
                rowCount++;

                // Validate required fields
                const email = row.email?.trim().toLowerCase();
                const phone = row.phone?.trim();
                const name = row.name?.trim();

                if (!email || !phone) {
                    errors.push(`Row ${rowCount}: Email and phone are required`);
                    return;
                }

                // Basic email validation
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    errors.push(`Row ${rowCount}: Invalid email format`);
                    return;
                }

                pollsters.push({
                    email,
                    phone,
                    name: name || '',
                    poll: pollId
                });
            })
            .on('end', async () => {
                try {
                    // Delete the uploaded file
                    fs.unlinkSync(csvFile.path);

                    if (errors.length > 0) {
                        throw new Error(`CSV processing errors: ${errors.join(', ')}`);
                    }

                    if (pollsters.length === 0) {
                        throw new Error('No valid pollster records found in CSV');
                    }

                    // Insert pollsters (with duplicate handling)
                    const insertedPollsters = [];
                    for (const pollsterData of pollsters) {
                        try {
                            const pollster = new Pollster(pollsterData);
                            await pollster.save();
                            insertedPollsters.push(pollster);
                        } catch (error) {
                            if (error.code === 11000) {
                                // Duplicate email for this poll - skip
                                continue;
                            }
                            throw error;
                        }
                    }

                    // Update poll with CSV upload history and total pollsters
                    await Poll.findByIdAndUpdate(pollId, {
                        $push: {
                            csvUploadHistory: {
                                filename: csvFile.originalname,
                                recordsCount: insertedPollsters.length,
                                uploadedBy
                            }
                        },
                        $inc: { totalPollsters: insertedPollsters.length }
                    });

                    resolve(insertedPollsters.length);
                } catch (error) {
                    reject(error);
                }
            })
            .on('error', (error) => {
                // Delete the uploaded file
                if (fs.existsSync(csvFile.path)) {
                    fs.unlinkSync(csvFile.path);
                }
                reject(error);
            });
    });
};

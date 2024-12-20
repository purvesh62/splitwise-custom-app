'use client'
import * as React from "react"
import {Button} from "@/components/ui/button"
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
} from "@/components/ui/drawer"
import {useForm} from "react-hook-form";
import {z} from "zod";
import {zodResolver} from "@hookform/resolvers/zod";

import {
	MultiSelector,
	MultiSelectorContent,
	MultiSelectorInput,
	MultiSelectorItem,
	MultiSelectorList,
	MultiSelectorTrigger,
} from "@/components/ui/multi-select";

import {Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,} from "@/components/ui/form"
import {Input} from "@/components/ui/input"
import {useToast} from "@/components/ui/use-toast";
import Image from "next/image";
import {useAction} from "next-safe-action/hooks";
import {createExpenseSchema} from "@/schema/create-expense-schema";
import {createExpense} from "@/server/actions/createExpense";

export function AddExpenseDrawer({userGroup}: { userGroup: SplitwiseGroup }) {
	const {toast} = useToast()
	const [paidBy, setPaidBy] = React.useState<string[]>([]);
	const [owedBy, setOwedBy] = React.useState<string[]>([]);
	const form = useForm<z.infer<typeof createExpenseSchema>>({
		resolver: zodResolver(createExpenseSchema),
		defaultValues: {
			amount: "",
			group_id: userGroup.id,
			description: "",
			currency_code: "CAD",
			users: [],
			paid_by: [],
			owed_by: [],
		},
	})
	
	const {execute} = useAction(createExpense, {
		onSuccess(data) {
			debugger
			if (data.success) {
				toast({
					variant: "default",
					title: "Expense created successfully",
					description: "Expense created successfully",
				})
				window.location.reload();
			} else {
				toast({
					variant: "destructive",
					title: "Expense creation failed",
					description: "Expense creation failed",
				})
			}
		},
	})
	
	
	function getCreateExpensePayload(paidBy: SplitwiseUser, owedBy: SplitwiseUser[], groupId: number, totalCost: number, description: string, currency: string = "CAD") {
		const isPayerInOwedBy = owedBy.some(user => user.id === paidBy.id);
		
		// Calculate equal share based on the number of owed users
		const numberOfOwedUsers = isPayerInOwedBy ? owedBy.length : owedBy.length + 1;
		totalCost = parseFloat(totalCost.toFixed(2));
		const equalShare: number = parseFloat((totalCost / numberOfOwedUsers).toFixed(2));
		
		debugger
		// Prepare users array
		const users = owedBy.map(user => ({
			user_id: user.id,
			paid_share: (user.id === paidBy.id ? totalCost : 0.00).toString(), // Paid amount only for the payer
			owed_share: equalShare.toString() // Everyone owes their share
		}));
		
		// If the payer is not in the owed users, add them explicitly
		if (!isPayerInOwedBy) {
			users.push({
				user_id: paidBy.id,
				paid_share: totalCost.toString(), // Total amount paid by this user
				owed_share: 0.00.toString() // Payer owes nothing
			});
		}
		
		if (totalCost > equalShare * numberOfOwedUsers) {
			// If the total cost is greater than the sum of owed shares, the payer owes the difference
			const difference = Number.parseFloat((totalCost - (equalShare * numberOfOwedUsers)).toFixed(2));
			users[0].owed_share = (Number.parseFloat(users[0].owed_share) + difference).toString();
		}
		
		// Construct the payload
		return {
			amount: totalCost.toFixed(2).toString(),
			description: description.toString(),
			group_id: groupId,
			currency_code: currency,
			users: users,
			paid_by: [],
			owed_by: []
		}
	}
	
	async function onSubmit(values: z.infer<typeof createExpenseSchema>) {
		if (paidBy.length === 0) {
			toast({
				variant: "destructive",
				title: "Uh oh! ",
				description: "You might have forgotten to select people to pay for the expense.",
			})
			return
		} else if (owedBy.length === 0) {
			toast({
				variant: "destructive",
				title: "Uh oh! ",
				description: "You might have forgotten to select people owed for the expense.",
			})
			return
		}
		const expensePayload = getCreateExpensePayload(
			userGroup.members.filter(member => paidBy.includes(member.email))[0],
			userGroup.members.filter(member => owedBy.includes(member.email)),
			userGroup.id,
			Number.parseFloat(values.amount),
			values.description,
		)
		console.log(expensePayload);
		if (expensePayload.group_id === 0) {
			setPaidBy([])
			setOwedBy([])
			form.reset()
			toast({
				variant: "destructive",
				title: "Uh oh! ",
				description: "Sorry I can't add expense on the non-group expenses."
			})
			return
		}
		execute(expensePayload);
		// setPaidBy([])
		// setOwedBy([])
		// form.reset()
	}
	
	const onChangePaidBy = (values: string[]) => {
		if (values.length == 1) {
			setPaidBy(values)
		} else if (values.length > 1) {
			setPaidBy([values[values.length - 1]])
		}
	}
	
	return (
		<div>
			<Drawer>
				<DrawerTrigger asChild className={"w-full"}>
					<Button
						variant="default"
						className={"w-32 justify-center bg-green-500 h-10 hover:bg-green-400"}>
						Add Expense
					</Button>
				</DrawerTrigger>
				<DrawerContent className={"min-h-96"}>
					<div className="mx-auto w-full max-w-lg">
						<DrawerHeader>
							<DrawerTitle>Add an Expense</DrawerTitle>
							<DrawerDescription></DrawerDescription>
						</DrawerHeader>
						<div className="px-4 py-10">
							<div className="flex w-full items-center justify-center ">
								<Form {...form}>
									<form onSubmit={form.handleSubmit(onSubmit)} className="w-full space-y-2">
										<FormField
											control={form.control}
											name="paid_by"
											render={({field}) => (
												<FormItem>
													<FormLabel>Paid By</FormLabel>
													<FormControl>
														<MultiSelector values={paidBy} onValuesChange={onChangePaidBy}
														               loop
														               className="">
															<MultiSelectorTrigger className={"shadow-sm"}>
																<MultiSelectorInput className={"w-full"}
																                    placeholder={"Select user who paid for the expense"}/>
															</MultiSelectorTrigger>
															<MultiSelectorContent>
																<MultiSelectorList>
																	{userGroup.members.map((member: SplitwiseUser) => (
																		<MultiSelectorItem
																			className={"w-full"}
																			key={member.id}
																			value={member.email as string}>
																			<div className="flex gap-2 items-center">
																				<div
																					className="flex gap-2 items-center">
																					<Image
																						alt={member.first_name}
																						className="flex-shrink-0 rounded-full"
																						width={40}
																						height={40}
																						src={member.picture?.medium as string}
																					/>
																					<div className="flex flex-col">
																						<span
																							className="text-small">{member.first_name}</span>
																						<span
																							className="text-tiny text-default-400">{member.email}</span>
																					</div>
																				</div>
																			</div>
																		</MultiSelectorItem>
																	))}
																</MultiSelectorList>
															</MultiSelectorContent>
														</MultiSelector>
													</FormControl>
													<FormMessage/>
												</FormItem>
											)}
										/>
										
										<FormField
											control={form.control}
											name="owed_by"
											render={({field}) => (
												<FormItem>
													<FormLabel>Owed By</FormLabel>
													<FormControl>
														<MultiSelector
															values={owedBy} onValuesChange={setOwedBy}
															loop
														>
															<MultiSelectorTrigger className={"shadow-sm"}>
																<MultiSelectorInput className={"w-full"}
																                    placeholder={"Select users who shares the expense"}/>
															</MultiSelectorTrigger>
															<MultiSelectorContent
																className={"min-h-40 overflow-y-auto"}>
																<MultiSelectorList className={""}>
																	{userGroup.members.map((member: SplitwiseUser) => (
																		<MultiSelectorItem
																			className={"w-full"}
																			key={member.id}
																			value={member.email.toString()}>
																			<div className="flex gap-2 items-center">
																				<div
																					className="flex gap-2 items-center">
																					<Image
																						alt={member.first_name}
																						className="flex-shrink-0 rounded-full"
																						width={40}
																						height={40}
																						src={member.picture?.medium as string}
																					/>
																					<div className="flex flex-col">
																						<span
																							className="text-small">{member.first_name}</span>
																						<span
																							className="text-tiny text-default-400">{member.email}</span>
																					</div>
																				</div>
																			</div>
																		</MultiSelectorItem>
																	))}
																</MultiSelectorList>
															</MultiSelectorContent>
														</MultiSelector>
													</FormControl>
													<FormMessage/>
												</FormItem>
											)}
										/>
										<FormField
											control={form.control}
											name="amount"
											render={({field}) => (
												<FormItem>
													<FormLabel>Amount</FormLabel>
													<FormControl>
														<Input type={"number"} placeholder="Enter amount" {...field} />
													</FormControl>
													<FormDescription>
														{/*This is your public display name.*/}
													</FormDescription>
													<FormMessage/>
												</FormItem>
											)}
										/>
										<FormField
											control={form.control}
											name="description"
											render={({field}) => (
												<FormItem>
													<FormLabel>Description</FormLabel>
													<FormControl>
														<Input type={"text"}
														       placeholder="Enter description" {...field} />
													</FormControl>
													<FormDescription>
														{/*This is your public display name.*/}
													</FormDescription>
													<FormMessage/>
												</FormItem>
											)}
										/>
										<DrawerFooter className={"w-full m-0 px-0 py-5"}>
											<Button type={"submit"}>Submit</Button>
											<DrawerClose asChild>
												<Button variant="outline">Cancel</Button>
											</DrawerClose>
										</DrawerFooter>
									</form>
								</Form>
							</div>
						</div>
					
					</div>
				</DrawerContent>
			</Drawer></div>
	)
}

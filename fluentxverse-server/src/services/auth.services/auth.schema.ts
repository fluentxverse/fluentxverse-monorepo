//** ELYSIA TYPE VALIDATION IMPORT
import { t } from "elysia";



// A minimal safe user shape returned to clients
export const UserSchema = t.Object({
    id: t.String(),
    userId: t.String(),
    email: t.String(),
    firstName: t.Optional(t.String()),
    lastName: t.Optional(t.String()),
    mobileNumber: t.String(),
    tier: t.Number(),
    role: t.String(),
    walletAddress: t.String()

});


export const RegisterSchema = {
    body: t.Object({
        email: t.String(),
        password: t.String(),
        firstName: t.String(),
        middleName: t.Optional(t.String()),
        lastName: t.String(),
        suffix: t.Optional(t.String()),
        birthDate: t.String(),
        mobileNumber: t.String(),
    }),
    response: {
        200: t.Object({
            success: t.Boolean(),
            message: t.String(),
            user: UserSchema
        })
    }
}




export const LoginSchema = {
    body: t.Object({
        email: t.String(),
        password: t.String(),
    }),
    response: {
        200: t.Object({
            success: t.Boolean(),
            user: t.Any()
        })
    }
}

export const LogoutSchema = {
    response: {
        200: t.Object({
            success: t.Boolean(),
            message: t.String()
        })
    }
}

export const MeSchema = {
    response: {
        200: t.Object({
            user: t.Object({
                userId: t.String(),
                email: t.String(),
                firstName: t.Optional(t.String()),
                lastName: t.Optional(t.String()),
                walletAddress: t.Optional(t.String()),
                mobileNumber: t.Optional(t.String()),
                tier: t.Number()
            })
        })
    }
}

export const UpdatePersonalInfoSchema = {
    body: t.Object({
        phoneNumber: t.Optional(t.String()),
        // Address
        country: t.Optional(t.String()),
        region: t.Optional(t.String()),
        regionName: t.Optional(t.String()),
        province: t.Optional(t.String()),
        provinceName: t.Optional(t.String()),
        city: t.Optional(t.String()),
        cityName: t.Optional(t.String()),
        zipCode: t.Optional(t.String()),
        addressLine: t.Optional(t.String()),
        sameAsPermanent: t.Optional(t.Boolean()),
        // Tutor Qualifications
        schoolAttended: t.Optional(t.String()),
        educationalAttainment: t.Optional(t.String()),
        major: t.Optional(t.String()),
        teachingExperience: t.Optional(t.String()),
        teachingQualifications: t.Optional(t.Array(t.String())),
        // Student Learning Preferences
        currentProficiency: t.Optional(t.String()),
        learningGoals: t.Optional(t.Array(t.String())),
        preferredLearningStyle: t.Optional(t.String()),
        availability: t.Optional(t.Array(t.String())),
    }),
    response: {
        200: t.Object({
            success: t.Boolean(),
            message: t.String()
        })
    }
}

export const UpdateEmailSchema = {
    body: t.Object({
        newEmail: t.String(),
        currentPassword: t.String()
    }),
    response: {
        200: t.Object({
            success: t.Boolean(),
            message: t.String()
        })
    }
}

export const UpdatePasswordSchema = {
    body: t.Object({
        currentPassword: t.String(),
        newPassword: t.String()
    }),
    response: {
        200: t.Object({
            success: t.Boolean(),
            message: t.String()
        })
    }
}